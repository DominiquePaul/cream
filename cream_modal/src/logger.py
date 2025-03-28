import os
import logfire
from functools import lru_cache

@lru_cache(maxsize=1)
def get_logger():
    """Get configured logger instance.

    Returns:
        The configured logfire instance, ready to use.
    """
    logfire.configure(environment=os.environ.get("LOGFIRE_ENV", "production"), scrubbing=False)
    return logfire

logger = get_logger()