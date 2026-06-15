import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "demos"))

from responses_streaming_structured_output import _parse_structured_output


class ResponsesStreamingStructuredOutputTest(unittest.TestCase):
    def test_parse_structured_output_uses_first_complete_json_object(self):
        first = {
            "summary": "Payment callbacks are delayed.",
            "severity": "high",
            "next_actions": ["Inspect callback queue", "Notify premium customers"],
        }
        second = {
            "summary": "Duplicate streamed completion.",
            "severity": "medium",
            "next_actions": ["Ignore duplicate"],
        }

        duplicated_output = json.dumps(first) + json.dumps(second)

        self.assertEqual(_parse_structured_output(duplicated_output), first)


if __name__ == "__main__":
    unittest.main()
