# Shared Demo Security

This module creates the shared identity baseline used by Enterprise AI demo modules:

- One dynamic group that matches resources in the demo compartment.
- One compartment-scoped policy that lets that dynamic group manage Generative AI, Autonomous Database, Database Tools, Vault secrets, and Object Storage resources needed by the demos.

Apply this module once during startup before the per-demo modules. Destroy it after per-demo modules during cleanup.

