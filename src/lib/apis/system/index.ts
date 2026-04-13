import { WEBUI_API_BASE_URL } from '$lib/constants';

/** `GET /api/v1/system/stats` (browser: same origin, e.g. dev server proxies to :8080). */
const SYSTEM_STATS_URL = `${WEBUI_API_BASE_URL}/system/stats`;

export type SystemDiskStats = {
	path: string;
	total: number;
	used: number;
	free: number;
	percent_used: number;
};

export type SystemStatsResponse = {
	disk: SystemDiskStats | null;
	cpu_percent: number;
	memory_percent: number;
};

export const getSystemStats = async (token: string): Promise<SystemStatsResponse | null> => {
	let error: unknown = null;

	const res = await fetch(SYSTEM_STATS_URL, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			authorization: `Bearer ${token}`
		}
	})
		.then(async (r) => {
			if (!r.ok) throw await r.json();
			return r.json();
		})
		.catch((err) => {
			error = err;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};
