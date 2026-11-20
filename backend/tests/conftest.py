"""
Shared test settings, loaded by pytest before any test file.
"""
import os

# The safety gate's AI checks (Groq) stay off in tests so they run offline and fast; its
# deterministic rules still run. test_safety_gate.py fakes the AI where it needs it.
os.environ["SAFETY_MODEL_ENABLED"] = "false"
