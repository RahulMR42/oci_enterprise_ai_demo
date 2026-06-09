#!/usr/bin/env python3
import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sys
import zipfile
from datetime import datetime, timezone

HASH_ALGORITHM = "PBKDF2-HMAC-SHA256"
HASH_ITERATIONS = 210_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SENSITIVE_KEY_PATTERN = re.compile(
    r"secret|password|passwd|passphrase|token|authorization|api[_-]?key|client[_-]?secret|credential|private[_-]?key|cookie|session|jwt|bearer",
    re.IGNORECASE,
)
SENSITIVE_KEY_NAMES = {
    "clientip",
    "ip",
    "ipaddress",
    "remoteaddress",
    "sessiontoken",
    "useragent",
}
IPV4_VALUE_PATTERN = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b"
)
UNSUPPORTED_ACTION_ERROR = "Unsupported auth store action."
GENERIC_CLI_ERROR = "Auth store command failed."
PUBLIC_CLI_ERRORS = {UNSUPPORTED_ACTION_ERROR}
SESSION_HASH_KEY_ENV = "OCI_PORTAL_SESSION_HASH_KEY"
DEBUG_ERROR_ENV = "OCI_PORTAL_AUTH_DEBUG"
DEFAULT_SESSION_HASH_KEY = "enterprise-ai-demo-portal-auth-store-session-hash-key"
DEFAULT_WALLET_CACHE_ROOT = "/tmp/enterprise-ai-portal-auth-wallets"
WALLET_PASSWORD_FILE = ".wallet-password"
ALLOWED_STORE_ACTIONS = {
    "init_schema",
    "signup",
    "login",
    "open_session",
    "close_session",
    "record_event",
    "query_activity",
}


class PublicCommandError(Exception):
    pass


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_email(value):
    email = str(value or "").strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise ValueError("Enter a valid email address.")
    return email


def hash_password(password, salt=None, iterations=HASH_ITERATIONS):
    raw_password = str(password or "")
    if len(raw_password) < 12:
        raise ValueError("Password must be at least 12 characters.")
    raw_salt = salt or secrets.token_bytes(24)
    if isinstance(raw_salt, str):
        raw_salt = base64.b64decode(raw_salt.encode("utf-8"))
    digest = hashlib.pbkdf2_hmac("sha256", raw_password.encode("utf-8"), raw_salt, int(iterations))
    return {
        "hashAlgorithm": HASH_ALGORITHM,
        "hashIterations": int(iterations),
        "passwordSalt": base64.b64encode(raw_salt).decode("ascii"),
        "passwordHash": base64.b64encode(digest).decode("ascii"),
    }


def verify_password(password, record):
    candidate = hash_password(
        password,
        salt=record["passwordSalt"],
        iterations=int(record["hashIterations"]),
    )
    return hmac.compare_digest(candidate["passwordHash"], record["passwordHash"])


def hmac_digest(value):
    key = os.environ.get(SESSION_HASH_KEY_ENV) or DEFAULT_SESSION_HASH_KEY
    return hmac.new(
        key.encode("utf-8"),
        str(value or "").encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def new_public_id(prefix):
    return f"{prefix}_{secrets.token_urlsafe(18)}"


def public_identity(row):
    email = row.get("email") or row.get("user_email")
    return {
        "userId": row.get("user_id") or row.get("id"),
        "userEmail": email,
        "displayEmail": row.get("display_email") or email,
        "authType": "protected_user",
        "role": row.get("role") or "user",
    }


def public_user(row):
    email = row.get("email") or row.get("user_email")
    return {
        "userId": row.get("user_id") or row.get("id"),
        "email": email,
        "displayEmail": row.get("display_email") or email,
        "role": row.get("role") or "user",
        "status": row.get("status") or "active",
        "createdAt": row.get("created_at"),
    }


def public_event(row):
    details = row.get("details") or {}
    if not isinstance(details, (dict, list)):
        try:
            details = json.loads(details)
        except (TypeError, json.JSONDecodeError):
            details = {}
    return {
        "eventId": row.get("event_id"),
        "sessionId": row.get("session_id"),
        "userEmail": row.get("user_email"),
        "eventType": row.get("event_type"),
        "featureId": row.get("feature_id"),
        "action": row.get("action"),
        "status": row.get("status"),
        "durationMs": row.get("duration_ms"),
        "details": details,
        "createdAt": row.get("created_at"),
    }


def is_sensitive_key(key):
    normalized = re.sub(r"[^a-z0-9]", "", str(key).lower())
    return normalized in SENSITIVE_KEY_NAMES or bool(SENSITIVE_KEY_PATTERN.search(str(key)))


def redact_details(value):
    if isinstance(value, list):
        return [redact_details(item) for item in value]
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            redacted[str(key)] = "<redacted>" if is_sensitive_key(key) else redact_details(item)
        return redacted
    if isinstance(value, str):
        redacted = re.sub(r"(bearer\s+)[A-Za-z0-9._~+/=-]{12,}", r"\1<redacted>", value, flags=re.IGNORECASE)
        return IPV4_VALUE_PATTERN.sub("<redacted-ip>", redacted)
    return value


def redact_error_text(value):
    text = str(redact_details(str(value or "")))
    text = re.sub(
        r"(?i)\b(password|passwd|passphrase|token|authorization|api[_-]?key|client[_-]?secret|credential|cookie|session)\b(\s*[:=]\s*)\S+",
        r"\1\2<redacted>",
        text,
    )
    return text[:500]


def safe_cli_error(exc):
    message = redact_error_text(exc)
    error_type = exc.__class__.__name__
    return f"{GENERIC_CLI_ERROR}: {error_type}: {message}" if message else f"{GENERIC_CLI_ERROR}: {error_type}"


def build_activity_filters(filters):
    clauses = []
    binds = {}
    if filters.get("userEmail"):
        clauses.append("LOWER(user_email) = :user_email")
        binds["user_email"] = normalize_email(filters["userEmail"])
    if filters.get("from"):
        clauses.append("created_at >= TO_TIMESTAMP_TZ(:from_ts, 'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM')")
        binds["from_ts"] = str(filters["from"]).replace("Z", "+00:00")
    if filters.get("to"):
        clauses.append("created_at <= TO_TIMESTAMP_TZ(:to_ts, 'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM')")
        binds["to_ts"] = str(filters["to"]).replace("Z", "+00:00")
    if filters.get("featureId"):
        clauses.append("feature_id = :feature_id")
        binds["feature_id"] = str(filters["featureId"])
    if filters.get("eventType"):
        clauses.append("event_type = :event_type")
        binds["event_type"] = str(filters["eventType"])
    if filters.get("status"):
        clauses.append("status = :status")
        binds["status"] = str(filters["status"])
    if filters.get("durationMs") is not None:
        clauses.append("duration_ms = :duration_ms")
        binds["duration_ms"] = int(filters["durationMs"])
    if filters.get("minDurationMs") is not None:
        clauses.append("duration_ms >= :min_duration_ms")
        binds["min_duration_ms"] = int(filters["minDurationMs"])
    if filters.get("maxDurationMs") is not None:
        clauses.append("duration_ms <= :max_duration_ms")
        binds["max_duration_ms"] = int(filters["maxDurationMs"])
    return (" AND ".join(clauses) if clauses else "1 = 1", binds)


class LocalJsonStore:
    def __init__(self, path):
        self.path = path

    def _empty_data(self):
        return {"users": [], "sessions": [], "events": []}

    def _normalize_data(self, data):
        if not isinstance(data, dict):
            data = {}
        normalized = dict(data)
        for key in ("users", "sessions", "events"):
            if not isinstance(normalized.get(key), list):
                normalized[key] = []
        return normalized

    def _load(self):
        if not os.path.exists(self.path):
            return self._empty_data()
        with open(self.path, "r", encoding="utf-8") as handle:
            raw = handle.read().strip()
        if not raw:
            return self._empty_data()
        data = json.loads(raw)
        data.setdefault("users", [])
        data.setdefault("sessions", [])
        data.setdefault("events", [])
        return data

    def _save(self, data):
        with open(self.path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, separators=(",", ":"), sort_keys=True)

    def init_schema(self, payload):
        data = self._normalize_data(self._load())
        self._save(data)
        return {"status": "success", "schema": "local-json"}

    def _audit_event(self, **values):
        now = utc_now_iso()
        return {
            "event_id": values.get("event_id") or new_public_id("evt"),
            "session_id": values.get("session_id"),
            "user_email": values.get("user_email"),
            "event_type": values.get("event_type"),
            "feature_id": values.get("feature_id"),
            "action": values.get("action"),
            "status": values.get("status"),
            "duration_ms": values.get("duration_ms"),
            "details": redact_details(values.get("details") or {}),
            "created_at": values.get("created_at") or now,
        }

    def signup(self, payload):
        data = self._load()
        email = normalize_email(payload.get("email"))
        if any(user.get("email") == email for user in data["users"]):
            return {"status": "failed", "error": "A protected user with that email already exists."}

        now = utc_now_iso()
        user = {
            "user_id": new_public_id("usr"),
            "email": email,
            "display_email": email,
            "role": "user",
            "status": "active",
            "created_at": now,
            "updated_at": now,
            **hash_password(payload.get("password")),
        }
        data["users"].append(user)
        data["events"].append(self._audit_event(
            user_email=email,
            event_type="signup",
            action="signup",
            status="success",
        ))
        self._save(data)
        return {
            "status": "success",
            "user": public_user(user),
            "identity": public_identity(user),
        }

    def login(self, payload):
        data = self._load()
        email = normalize_email(payload.get("email"))
        user = next(
            (
                candidate for candidate in data["users"]
                if candidate.get("email") == email and candidate.get("status") == "active"
            ),
            None,
        )
        if not user or not verify_password(payload.get("password"), user):
            data["events"].append(self._audit_event(
                user_email=email,
                event_type="login_failed",
                action="login",
                status="failed",
            ))
            self._save(data)
            return {"status": "failed", "error": "Invalid email or password."}

        now = utc_now_iso()
        user["last_login_at"] = now
        user["updated_at"] = now
        data["events"].append(self._audit_event(
            user_email=email,
            event_type="login",
            action="login",
            status="success",
        ))
        self._save(data)
        return {"status": "success", "identity": public_identity(user)}

    def open_session(self, payload):
        data = self._load()
        identity = payload.get("identity") or {}
        email = normalize_email(identity.get("userEmail"))
        now = utc_now_iso()
        session_id = new_public_id("sess")
        data["sessions"].append({
            "session_id": session_id,
            "session_token_hash": hmac_digest(payload.get("sessionToken")),
            "user_id": identity.get("userId"),
            "user_email": email,
            "ip_hash": hmac_digest(payload.get("ip")),
            "user_agent_hash": hmac_digest(payload.get("userAgent")),
            "status": "active",
            "created_at": now,
            "last_seen_at": now,
        })
        self._save(data)
        return {"status": "success", "sessionId": session_id}

    def close_session(self, payload):
        data = self._load()
        token_hash = hmac_digest(payload.get("sessionToken"))
        session = next(
            (
                candidate for candidate in data["sessions"]
                if candidate.get("session_token_hash") == token_hash
            ),
            None,
        )
        if not session:
            return {"status": "failed", "error": "Session not found."}

        now = utc_now_iso()
        session["status"] = "logged_out"
        session["closed_at"] = now
        data["events"].append(self._audit_event(
            session_id=session.get("session_id"),
            user_email=session.get("user_email"),
            event_type="logout",
            action="logout",
            status="success",
            created_at=now,
        ))
        self._save(data)
        return {"status": "success"}

    def record_event(self, payload):
        data = self._load()
        identity = payload.get("identity") or {}
        email = normalize_email(identity.get("userEmail"))
        event = self._audit_event(
            session_id=payload.get("sessionId"),
            user_email=email,
            event_type=str(payload.get("eventType") or ""),
            feature_id=payload.get("featureId"),
            action=payload.get("action"),
            status=payload.get("status"),
            duration_ms=payload.get("durationMs"),
            details=payload.get("details") or {},
        )
        data["events"].append(event)
        self._save(data)
        return {"status": "success", "eventId": event["event_id"]}

    def query_activity(self, payload):
        data = self._load()
        filters = payload.get("filters") or {}
        _, binds = build_activity_filters(filters)
        events = [
            event for event in data["events"]
            if self._matches_filters(event, filters, binds)
        ]
        events.sort(key=lambda event: event.get("created_at") or "", reverse=True)
        return {
            "status": "success",
            "metrics": {"totalEvents": len(events)},
            "events": [public_event(event) for event in events],
        }

    def _matches_filters(self, event, filters, binds):
        if "user_email" in binds and event.get("user_email") != binds["user_email"]:
            return False
        if "feature_id" in binds and event.get("feature_id") != binds["feature_id"]:
            return False
        if "event_type" in binds and event.get("event_type") != binds["event_type"]:
            return False
        if "status" in binds and event.get("status") != binds["status"]:
            return False
        if "duration_ms" in binds and int(event.get("duration_ms") or 0) != binds["duration_ms"]:
            return False
        if "min_duration_ms" in binds and int(event.get("duration_ms") or 0) < binds["min_duration_ms"]:
            return False
        if "max_duration_ms" in binds and int(event.get("duration_ms") or 0) > binds["max_duration_ms"]:
            return False
        if filters.get("from") and str(event.get("created_at") or "") < str(filters["from"]):
            return False
        if filters.get("to") and str(event.get("created_at") or "") > str(filters["to"]):
            return False
        return True


class AdbStore:
    def __init__(self, user, password, dsn, wallet_dir=None, wallet_password=None):
        import oracledb

        effective_dsn = self._resolve_wallet_dsn(dsn, wallet_dir) if wallet_dir else dsn
        connect_args = {"user": user, "password": password, "dsn": effective_dsn}
        if wallet_dir:
            connect_args.update({
                "config_dir": wallet_dir,
                "wallet_location": wallet_dir,
            })
        if wallet_password:
            connect_args["wallet_password"] = wallet_password
        self.connection = oracledb.connect(**connect_args)

    @classmethod
    def from_env(cls, env=os.environ):
        password = env.get("OCI_PORTAL_AUTH_DB_PASSWORD")
        if not password:
            password = cls._password_from_secret(env["OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID"])
        wallet_dir, wallet_password = cls._wallet_from_env(env)
        return cls(
            user=env["OCI_PORTAL_AUTH_DB_USER"],
            password=password,
            dsn=env["OCI_PORTAL_AUTH_DB_DSN"],
            wallet_dir=wallet_dir,
            wallet_password=wallet_password,
        )

    @classmethod
    def _resolve_wallet_dsn(cls, dsn, wallet_dir):
        entries = cls._tnsnames_entries(wallet_dir)
        if not dsn or not entries:
            return dsn

        raw_dsn = str(dsn).strip()
        aliases = {alias.lower(): alias for alias, _ in entries}
        if raw_dsn.lower() in aliases:
            return aliases[raw_dsn.lower()]

        target_service_name = cls._service_name_from_dsn(raw_dsn)
        if not target_service_name:
            return dsn

        target_service_name = target_service_name.lower()
        for alias, descriptor in entries:
            entry_service_name = cls._service_name_from_dsn(descriptor)
            if entry_service_name and entry_service_name.lower() == target_service_name:
                return alias

        for alias, _ in entries:
            if alias.lower() in target_service_name:
                return alias
        return dsn

    @staticmethod
    def _tnsnames_entries(wallet_dir):
        path = os.path.join(wallet_dir, "tnsnames.ora")
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read()
        matches = list(re.finditer(r"(?im)^\s*([A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)*)\s*=", content))
        entries = []
        for index, match in enumerate(matches):
            value_end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
            descriptor = content[match.end():value_end].strip()
            for alias in match.group(1).split(","):
                alias = alias.strip()
                if alias:
                    entries.append((alias, descriptor))
        return entries

    @staticmethod
    def _service_name_from_dsn(dsn):
        match = re.search(r"service_name\s*=\s*([^\s)]+)", str(dsn), flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()

        raw_dsn = str(dsn).strip()
        if raw_dsn.startswith("(") or "/" not in raw_dsn:
            return None
        return raw_dsn.split("/", 1)[1].split("?", 1)[0].strip() or None

    @staticmethod
    def _oci_config(env=os.environ):
        for key in ("OCI_REGION", "OCI_CLI_REGION", "OCI_RESOURCE_PRINCIPAL_REGION"):
            region = str(env.get(key) or "").strip()
            if region:
                return {"region": region}
        return {}

    @classmethod
    def _password_from_secret(cls, secret_id):
        import oci

        signer = oci.auth.signers.get_resource_principals_signer()
        client = oci.secrets.SecretsClient(config=cls._oci_config(), signer=signer)
        bundle = client.get_secret_bundle(secret_id).data
        encoded = bundle.secret_bundle_content.content
        return base64.b64decode(encoded).decode("utf-8")

    @classmethod
    def _wallet_from_env(cls, env):
        wallet_dir = env.get("OCI_PORTAL_AUTH_DB_WALLET_DIR")
        wallet_password = env.get("OCI_PORTAL_AUTH_DB_WALLET_PASSWORD")
        if wallet_dir:
            return wallet_dir, wallet_password or None

        database_id = env.get("OCI_PORTAL_AUTH_DB_ID")
        if not database_id:
            return None, None

        cache_dir = env.get("OCI_PORTAL_AUTH_DB_WALLET_CACHE_DIR") or os.path.join(
            DEFAULT_WALLET_CACHE_ROOT,
            hashlib.sha256(database_id.encode("utf-8")).hexdigest()[:16],
        )
        return cls._ensure_wallet(database_id, cache_dir, wallet_password)

    @classmethod
    def _ensure_wallet(cls, database_id, cache_dir, wallet_password=None):
        os.makedirs(cache_dir, mode=0o700, exist_ok=True)
        password_file = os.path.join(cache_dir, WALLET_PASSWORD_FILE)
        tnsnames_file = os.path.join(cache_dir, "tnsnames.ora")
        if os.path.exists(tnsnames_file):
            return cache_dir, wallet_password or cls._read_wallet_password(password_file)

        generated_password = wallet_password or secrets.token_urlsafe(32)
        wallet_bytes = cls._download_wallet(database_id, generated_password)
        cls._extract_wallet(wallet_bytes, cache_dir)
        cls._write_wallet_password(password_file, generated_password)
        return cache_dir, generated_password

    @staticmethod
    def _read_wallet_password(password_file):
        if not os.path.exists(password_file):
            return None
        with open(password_file, "r", encoding="utf-8") as handle:
            return handle.read().strip() or None

    @staticmethod
    def _write_wallet_password(password_file, wallet_password):
        fd = os.open(password_file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(f"{wallet_password}\n")

    @classmethod
    def _download_wallet(cls, database_id, wallet_password):
        import oci
        from oci.database.models import GenerateAutonomousDatabaseWalletDetails

        signer = oci.auth.signers.get_resource_principals_signer()
        client = oci.database.DatabaseClient(config=cls._oci_config(), signer=signer)
        details = GenerateAutonomousDatabaseWalletDetails(
            generate_type=GenerateAutonomousDatabaseWalletDetails.GENERATE_TYPE_SINGLE,
            password=wallet_password,
        )
        data = client.generate_autonomous_database_wallet(database_id, details).data
        if hasattr(data, "read"):
            data = data.read()
        if isinstance(data, str):
            data = data.encode("utf-8")
        return data

    @staticmethod
    def _extract_wallet(wallet_bytes, cache_dir):
        cache_root = os.path.abspath(cache_dir)
        with zipfile.ZipFile(io.BytesIO(wallet_bytes)) as archive:
            for member in archive.infolist():
                target = os.path.abspath(os.path.join(cache_dir, member.filename))
                if target != cache_root and not target.startswith(f"{cache_root}{os.sep}"):
                    raise ValueError("Wallet archive contains an unsafe path.")
                archive.extract(member, cache_dir)

    def init_schema(self, payload):
        with self.connection.cursor() as cursor:
            existing = self._existing_tables(cursor)
            if "PORTAL_PROTECTED_USERS" not in existing:
                cursor.execute("""
                    CREATE TABLE PORTAL_PROTECTED_USERS (
                        USER_ID VARCHAR2(80) PRIMARY KEY,
                        EMAIL VARCHAR2(320) UNIQUE NOT NULL,
                        DISPLAY_EMAIL VARCHAR2(320),
                        ROLE VARCHAR2(64) DEFAULT 'user' NOT NULL,
                        STATUS VARCHAR2(32) DEFAULT 'active' NOT NULL,
                        HASH_ALGORITHM VARCHAR2(64) NOT NULL,
                        HASH_ITERATIONS NUMBER NOT NULL,
                        PASSWORD_SALT VARCHAR2(128) NOT NULL,
                        PASSWORD_HASH VARCHAR2(256) NOT NULL,
                        CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
                        UPDATED_AT TIMESTAMP WITH TIME ZONE,
                        LAST_LOGIN_AT TIMESTAMP WITH TIME ZONE
                    )
                """)
            if "PORTAL_AUTH_SESSIONS" not in existing:
                cursor.execute("""
                    CREATE TABLE PORTAL_AUTH_SESSIONS (
                        SESSION_ID VARCHAR2(80) PRIMARY KEY,
                        SESSION_TOKEN_HASH VARCHAR2(128) UNIQUE NOT NULL,
                        USER_ID VARCHAR2(80),
                        USER_EMAIL VARCHAR2(320),
                        IP_HASH VARCHAR2(128),
                        USER_AGENT_HASH VARCHAR2(128),
                        STATUS VARCHAR2(32) DEFAULT 'active' NOT NULL,
                        CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
                        LAST_SEEN_AT TIMESTAMP WITH TIME ZONE,
                        CLOSED_AT TIMESTAMP WITH TIME ZONE
                    )
                """)
            if "PORTAL_AUDIT_EVENTS" not in existing:
                cursor.execute("""
                    CREATE TABLE PORTAL_AUDIT_EVENTS (
                        EVENT_ID VARCHAR2(80) PRIMARY KEY,
                        SESSION_ID VARCHAR2(80),
                        USER_ID VARCHAR2(80),
                        USER_EMAIL VARCHAR2(320),
                        EVENT_TYPE VARCHAR2(128),
                        FEATURE_ID VARCHAR2(128),
                        ACTION VARCHAR2(128),
                        STATUS VARCHAR2(64),
                        DURATION_MS NUMBER,
                        DETAILS CLOB,
                        CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
                    )
                """)
        self.connection.commit()
        return {"status": "success", "schema": "autonomous-database"}

    def _existing_tables(self, cursor):
        cursor.execute("""
            SELECT TABLE_NAME
            FROM USER_TABLES
            WHERE TABLE_NAME IN (
                'PORTAL_PROTECTED_USERS',
                'PORTAL_AUTH_SESSIONS',
                'PORTAL_AUDIT_EVENTS'
            )
        """)
        return {row[0] for row in cursor.fetchall()}

    def signup(self, payload):
        email = normalize_email(payload.get("email"))
        password_record = hash_password(payload.get("password"))
        user = {
            "user_id": new_public_id("usr"),
            "email": email,
            "display_email": email,
            "role": "user",
            "status": "active",
        }
        with self.connection.cursor() as cursor:
            existing = self._fetch_user(cursor, email)
            if existing:
                return {"status": "failed", "error": "A protected user with that email already exists."}
            cursor.execute("""
                INSERT INTO PORTAL_PROTECTED_USERS (
                    USER_ID, EMAIL, DISPLAY_EMAIL, ROLE, STATUS, HASH_ALGORITHM,
                    HASH_ITERATIONS, PASSWORD_SALT, PASSWORD_HASH, CREATED_AT, UPDATED_AT
                ) VALUES (
                    :user_id, :email, :display_email, :role, :status, :hash_algorithm,
                    :hash_iterations, :password_salt, :password_hash, SYSTIMESTAMP, SYSTIMESTAMP
                )
            """, {
                **user,
                "hash_algorithm": password_record["hashAlgorithm"],
                "hash_iterations": password_record["hashIterations"],
                "password_salt": password_record["passwordSalt"],
                "password_hash": password_record["passwordHash"],
            })
            self._insert_audit_event(
                cursor,
                user_email=email,
                event_type="signup",
                action="signup",
                status="success",
            )
        self.connection.commit()
        return {
            "status": "success",
            "user": public_user(user),
            "identity": public_identity(user),
        }

    def login(self, payload):
        email = normalize_email(payload.get("email"))
        with self.connection.cursor() as cursor:
            user = self._fetch_user(cursor, email, active_only=True)
            if not user or not verify_password(payload.get("password"), self._password_record(user)):
                self._insert_audit_event(
                    cursor,
                    user_email=email,
                    event_type="login_failed",
                    action="login",
                    status="failed",
                )
                self.connection.commit()
                return {"status": "failed", "error": "Invalid email or password."}
            cursor.execute("""
                UPDATE PORTAL_PROTECTED_USERS
                SET LAST_LOGIN_AT = SYSTIMESTAMP, UPDATED_AT = SYSTIMESTAMP
                WHERE USER_ID = :user_id
            """, {"user_id": user["user_id"]})
            self._insert_audit_event(
                cursor,
                user_id=user["user_id"],
                user_email=email,
                event_type="login",
                action="login",
                status="success",
            )
        self.connection.commit()
        return {"status": "success", "identity": public_identity(user)}

    def open_session(self, payload):
        identity = payload.get("identity") or {}
        email = normalize_email(identity.get("userEmail"))
        session_id = new_public_id("sess")
        with self.connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO PORTAL_AUTH_SESSIONS (
                    SESSION_ID, SESSION_TOKEN_HASH, USER_ID, USER_EMAIL,
                    IP_HASH, USER_AGENT_HASH, STATUS, CREATED_AT, LAST_SEEN_AT
                ) VALUES (
                    :session_id, :session_token_hash, :user_id, :user_email,
                    :ip_hash, :user_agent_hash, 'active', SYSTIMESTAMP, SYSTIMESTAMP
                )
            """, {
                "session_id": session_id,
                "session_token_hash": hmac_digest(payload.get("sessionToken")),
                "user_id": identity.get("userId"),
                "user_email": email,
                "ip_hash": hmac_digest(payload.get("ip")),
                "user_agent_hash": hmac_digest(payload.get("userAgent")),
            })
        self.connection.commit()
        return {"status": "success", "sessionId": session_id}

    def close_session(self, payload):
        token_hash = hmac_digest(payload.get("sessionToken"))
        with self.connection.cursor() as cursor:
            cursor.execute("""
                SELECT SESSION_ID, USER_ID, USER_EMAIL
                FROM PORTAL_AUTH_SESSIONS
                WHERE SESSION_TOKEN_HASH = :token_hash
            """, {"token_hash": token_hash})
            row = self._row_as_dict(cursor)
            if not row:
                return {"status": "failed", "error": "Session not found."}
            cursor.execute("""
                UPDATE PORTAL_AUTH_SESSIONS
                SET STATUS = 'logged_out', CLOSED_AT = SYSTIMESTAMP
                WHERE SESSION_TOKEN_HASH = :token_hash
            """, {"token_hash": token_hash})
            self._insert_audit_event(
                cursor,
                session_id=row["session_id"],
                user_id=row["user_id"],
                user_email=row["user_email"],
                event_type="logout",
                action="logout",
                status="success",
            )
        self.connection.commit()
        return {"status": "success"}

    def record_event(self, payload):
        identity = payload.get("identity") or {}
        email = normalize_email(identity.get("userEmail"))
        event_id = new_public_id("evt")
        with self.connection.cursor() as cursor:
            self._insert_audit_event(
                cursor,
                event_id=event_id,
                session_id=payload.get("sessionId"),
                user_id=identity.get("userId"),
                user_email=email,
                event_type=str(payload.get("eventType") or ""),
                feature_id=payload.get("featureId"),
                action=payload.get("action"),
                status=payload.get("status"),
                duration_ms=payload.get("durationMs"),
                details=payload.get("details") or {},
            )
        self.connection.commit()
        return {"status": "success", "eventId": event_id}

    def query_activity(self, payload):
        filters = payload.get("filters") or {}
        where_sql, binds = build_activity_filters(filters)
        with self.connection.cursor() as cursor:
            cursor.execute(
                f"SELECT COUNT(*) FROM PORTAL_AUDIT_EVENTS WHERE {where_sql}",
                binds,
            )
            total_events = int(cursor.fetchone()[0])
            cursor.execute(f"""
                SELECT EVENT_ID, SESSION_ID, USER_ID, USER_EMAIL, EVENT_TYPE, FEATURE_ID,
                       ACTION, STATUS, DURATION_MS, DETAILS,
                       TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') AS CREATED_AT
                FROM PORTAL_AUDIT_EVENTS
                WHERE {where_sql}
                ORDER BY CREATED_AT DESC
                FETCH FIRST 200 ROWS ONLY
            """, binds)
            events = self._all_rows_as_dicts(cursor)
        return {
            "status": "success",
            "metrics": {"totalEvents": total_events},
            "events": [public_event(self._coerce_event(row)) for row in events],
        }

    def _fetch_user(self, cursor, email, active_only=False):
        status_clause = "AND STATUS = 'active'" if active_only else ""
        cursor.execute(f"""
            SELECT USER_ID, EMAIL, DISPLAY_EMAIL, ROLE, STATUS, HASH_ALGORITHM,
                   HASH_ITERATIONS, PASSWORD_SALT, PASSWORD_HASH
            FROM PORTAL_PROTECTED_USERS
            WHERE LOWER(EMAIL) = :email {status_clause}
        """, {"email": email})
        return self._row_as_dict(cursor)

    def _password_record(self, row):
        return {
            "hashAlgorithm": row["hash_algorithm"],
            "hashIterations": row["hash_iterations"],
            "passwordSalt": row["password_salt"],
            "passwordHash": row["password_hash"],
        }

    def _insert_audit_event(self, cursor, **values):
        cursor.execute("""
            INSERT INTO PORTAL_AUDIT_EVENTS (
                EVENT_ID, SESSION_ID, USER_ID, USER_EMAIL, EVENT_TYPE, FEATURE_ID,
                ACTION, STATUS, DURATION_MS, DETAILS, CREATED_AT
            ) VALUES (
                :event_id, :session_id, :user_id, :user_email, :event_type, :feature_id,
                :action, :status, :duration_ms, :details, SYSTIMESTAMP
            )
        """, {
            "event_id": values.get("event_id") or new_public_id("evt"),
            "session_id": values.get("session_id"),
            "user_id": values.get("user_id"),
            "user_email": values.get("user_email"),
            "event_type": values.get("event_type"),
            "feature_id": values.get("feature_id"),
            "action": values.get("action"),
            "status": values.get("status"),
            "duration_ms": values.get("duration_ms"),
            "details": json.dumps(redact_details(values.get("details") or {}), separators=(",", ":")),
        })

    def _row_as_dict(self, cursor):
        row = cursor.fetchone()
        if not row:
            return None
        columns = [column[0].lower() for column in cursor.description]
        return dict(zip(columns, row))

    def _all_rows_as_dicts(self, cursor):
        columns = [column[0].lower() for column in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    def _coerce_event(self, row):
        details = row.get("details")
        if hasattr(details, "read"):
            details = details.read()
        return {**row, "details": details}


def configured_from_env(env=os.environ):
    return bool(env.get("OCI_PORTAL_AUTH_DB_DSN") and env.get("OCI_PORTAL_AUTH_DB_USER") and (
        env.get("OCI_PORTAL_AUTH_DB_PASSWORD") or env.get("OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID")
    ))


def handle_status():
    configured = configured_from_env()
    return {
        "ok": True,
        "configured": configured,
        "status": "configured" if configured else "disabled",
        "source": "nl2sql-autonomous-database" if configured else "not-configured",
    }


def store_for_env():
    test_file = os.environ.get("OCI_PORTAL_AUTH_STORE_TEST_FILE")
    if test_file:
        return LocalJsonStore(test_file)
    if configured_from_env():
        return AdbStore.from_env()
    return None


def handle_command(command):
    action = command.get("action") or ""
    payload = command.get("payload") or {}
    if action == "status":
        return handle_status()
    if action not in ALLOWED_STORE_ACTIONS:
        raise PublicCommandError(UNSUPPORTED_ACTION_ERROR)
    store = store_for_env()
    if store is None:
        return {"ok": False, "status": "disabled", "error": "Portal protected-user auth store is not configured."}
    return getattr(store, action)(payload)


def main():
    try:
        command = json.loads(sys.stdin.read() or "{}")
        response = handle_command(command)
        print(json.dumps(response, separators=(",", ":")))
    except Exception as exc:
        error = str(exc)
        if error not in PUBLIC_CLI_ERRORS:
            error = safe_cli_error(exc) if os.environ.get(DEBUG_ERROR_ENV) == "public" else GENERIC_CLI_ERROR
        print(json.dumps({"ok": False, "status": "failed", "error": error}, separators=(",", ":")))
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
