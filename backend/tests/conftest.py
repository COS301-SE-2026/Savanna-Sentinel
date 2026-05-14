import asyncio
import inspect
import os

os.environ.setdefault("JWT_SECRET", "Testing-secret-not-used-in-production")

import pytest


def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: mark a test function as async")


def pytest_pyfunc_call(pyfuncitem):
    if "asyncio" not in pyfuncitem.keywords:
        return None

    test_function = pyfuncitem.obj
    if not inspect.iscoroutinefunction(test_function):
        return None

    test_arguments = {
        name: pyfuncitem.funcargs[name]
        for name in pyfuncitem._fixtureinfo.argnames
    }

    asyncio.run(test_function(**test_arguments))
    return True


@pytest.fixture(autouse=True)
def setup_env():
    yield