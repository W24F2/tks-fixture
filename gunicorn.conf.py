"""
Gunicorn configuration for production deployment.
Optimized for ~100 concurrent users.
"""
import multiprocessing
import os

# Server socket
bind = os.getenv("GUNICORN_BIND", "127.0.0.1:5002")
backlog = 2048

# Worker processes
# Formula: (2 * CPU cores) + 1 for sync workers
# For gthread workers: 2-4 workers with multiple threads each
workers = int(os.getenv("GUNICORN_WORKERS", str(multiprocessing.cpu_count() * 2 + 1)))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")
threads = int(os.getenv("GUNICORN_THREADS", "4"))
worker_connections = 1000

# Timeouts
timeout = 30
graceful_timeout = 30
keepalive = 5

# Request limits
max_requests = 1000
max_requests_jitter = 50

# Preload application for memory efficiency
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "fixtures-app"

# Security
limit_request_fields = 100
limit_request_field_size = 8190
limit_request_line = 4094

# Worker recycling
max_worker_memory = 200  # MB - recycle workers if they exceed this

# SSL (if terminating SSL at gunicorn)
# keyfile = "/path/to/key.pem"
# certfile = "/path/to/cert.pem"


def when_ready(server):
    server.log.info("Server is ready. Spawning workers...")


def worker_int(worker):
    worker.log.info("Worker received INT or QUIT signal")


def pre_fork(server, worker):
    server.log.info(f"Spawning worker {worker.pid}")


def post_fork(server, worker):
    server.log.info(f"Worker {worker.pid} spawned")


def worker_abort(worker):
    worker.log.info(f"Worker {worker.pid} aborted")


def child_exit(server, worker):
    server.log.info(f"Worker {worker.pid} exited")