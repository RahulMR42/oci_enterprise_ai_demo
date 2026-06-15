# Shared Demo Security

This module creates the shared identity baseline for Enterprise AI demo modules:

- One dynamic group that matches resources in the demo compartment.
- One compartment-scoped policy that lets the dynamic group manage the Generative AI, Autonomous Database, Database Tools, Vault, and Object Storage resources needed by the demos.

Apply this module before per-demo modules. Destroy it after per-demo modules during cleanup.
