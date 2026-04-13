import logging
import platform
import shutil

import psutil
from fastapi import APIRouter, Depends

from open_webui.utils.auth import get_verified_user

log = logging.getLogger(__name__)

router = APIRouter()


def _primary_disk_path() -> str:
    if platform.system() == 'Windows':
        return 'C:\\'
    return '/'


@router.get('/stats')
async def get_system_stats(_user=Depends(get_verified_user)):
    path = _primary_disk_path()
    disk_payload = None
    try:
        du = shutil.disk_usage(path)
        total = int(du.total)
        used = int(du.used)
        free = int(du.free)
        disk_payload = {
            'path': path,
            'total': total,
            'used': used,
            'free': free,
            'percent_used': round((used / total) * 100, 2) if total else 0.0,
        }
    except OSError:
        log.exception('shutil.disk_usage failed for %s', path)

    cpu_percent = float(psutil.cpu_percent(interval=0.1))
    memory_percent = float(psutil.virtual_memory().percent)

    return {
        'disk': disk_payload,
        'cpu_percent': round(cpu_percent, 1),
        'memory_percent': round(memory_percent, 1),
    }
