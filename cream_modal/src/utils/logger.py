import os
from functools import lru_cache

# Set this environment variable to disable Logfire authentication requirements
os.environ["LOGFIRE_DISABLE_RUNTIME_VERIFICATION"] = "1"

@lru_cache(maxsize=1)
def get_logger():
    """Get configured logger instance.

    Returns:
        The configured logger instance, ready to use.
    """
    try:
        import logfire
        # Basic config with no remote logging
        logfire.configure(
            environment=os.environ.get("LOGFIRE_ENV", "development"),
            scrubbing=False
        )
    except Exception as e:
        logfire.configure(send_to_logfire=False)
        logfire.warn(f"Error configuring logfire: {e}")
    return logfire
        
logger = get_logger()