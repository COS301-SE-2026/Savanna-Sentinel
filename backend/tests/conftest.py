import os
import pytest

@pytest.fixture(autouse=True)
def setup_env():
    os.environ["JWT_SECRET"] = "Testing-secret-not-used-in-production"