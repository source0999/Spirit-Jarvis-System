<script lang="ts">
	import { getContext, createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';

	const dispatch = createEventDispatcher();

	import { getChatList } from '$lib/apis/chats';
	import { getSystemStats } from '$lib/apis/system';

	import {
		config,
		user,
		models as _models,
		temporaryChatEnabled,
		selectedFolder,
		chats,
		currentChatPage
	} from '$lib/stores';
	import { WEBUI_API_BASE_URL, BRANDING_LOGO_URL } from '$lib/constants';

	import Suggestions from './Suggestions.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import EyeSlash from '$lib/components/icons/EyeSlash.svelte';
	import MessageInput from './MessageInput.svelte';
	import FolderPlaceholder from './Placeholder/FolderPlaceholder.svelte';
	import FolderTitle from './Placeholder/FolderTitle.svelte';
	import StatsCard from '$lib/components/dashboard/StatsCard.svelte';

	const i18n = getContext('i18n');

	export let createMessagePair: Function;
	export let stopResponse: Function;

	export let autoScroll = false;

	export let atSelectedModel: Model | undefined;
	export let selectedModels: [''];

	export let history;

	export let prompt = '';
	export let files = [];
	export let messageInput = null;

	export let selectedToolIds = [];
	export let selectedFilterIds = [];
	export let pendingOAuthTools = [];

	export let showCommands = false;

	export let imageGenerationEnabled = false;
	export let codeInterpreterEnabled = false;
	export let webSearchEnabled = false;

	export let onUpload: Function = (e) => {};
	export let onSelect = (e) => {};
	export let onChange = (e) => {};

	export let toolServers = [];

	export let dragged = false;

	let models = [];
	let selectedModelIdx = 0;

	$: if (selectedModels.length > 0) {
		selectedModelIdx = models.length - 1;
	}

	$: models = selectedModels.map((id) => $_models.find((m) => m.id === id));

	const activeNodes = [
		{ id: 'bbr', name: 'Black Box Reality' },
		{ id: 'mn', name: 'Movie Night' }
	];

	const CPU_HISTORY_MAX = 48;

	function formatBytes(bytes: number | null | undefined): string {
		if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let u = 0;
		let v = bytes;
		while (v >= 1024 && u < units.length - 1) {
			v /= 1024;
			u++;
		}
		const dec = u === 0 ? 0 : v < 10 ? 2 : 1;
		return `${v.toFixed(dec)} ${units[u]}`;
	}

	function diskLabelPath(path: string | undefined): string {
		if (!path) return '';
		const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
		if (/^[A-Za-z]:$/.test(normalized)) return normalized.toUpperCase();
		if (normalized === '/') return '/';
		const parts = normalized.split('/').filter(Boolean);
		return parts.length ? parts[parts.length - 1] : '/';
	}

	let diskTotal: number | null = null;
	let diskUsed: number | null = null;
	let diskPercentUsed: number | null = null;
	let diskPathLabel = '';
	let cpuPercent: number | null = null;
	let memoryPercent: number | null = null;
	let cpuHistory: number[] = [];
	/** True after a successful response with usable disk stats (never show placeholder TB). */
	let diskStatsReady = false;

	function resetSystemStatsDisplay() {
		diskTotal = null;
		diskUsed = null;
		diskPercentUsed = null;
		diskPathLabel = '';
		cpuPercent = null;
		memoryPercent = null;
		cpuHistory = [];
		diskStatsReady = false;
	}

	$: cpuChartSeries =
		cpuHistory.length === 0
			? []
			: cpuHistory.length === 1
				? [cpuHistory[0], cpuHistory[0]]
				: cpuHistory;

	$: cpuHistoryPoints =
		cpuChartSeries.length < 2
			? ''
			: (() => {
					const w = 100;
					const h = 40;
					const pad = 3;
					const innerW = w - 2 * pad;
					const innerH = h - 2 * pad;
					return cpuChartSeries
						.map((v, i) => {
							const x = pad + (i / (cpuChartSeries.length - 1)) * innerW;
							const clamped = Math.min(100, Math.max(0, v));
							const y = pad + innerH - (clamped / 100) * innerH;
							return `${x.toFixed(2)},${y.toFixed(2)}`;
						})
						.join(' ');
				})();

	let statsPoll: ReturnType<typeof setInterval> | undefined;

	async function refreshSystemStats() {
		if (get(selectedFolder)) return;
		const token = localStorage.token;
		if (!token) return;
		try {
			const data = await getSystemStats(token);
			if (!data) {
				resetSystemStatsDisplay();
				return;
			}
			cpuPercent = data.cpu_percent;
			memoryPercent = data.memory_percent;
			cpuHistory = [...cpuHistory.slice(-(CPU_HISTORY_MAX - 1)), data.cpu_percent];
			if (data.disk) {
				diskTotal = data.disk.total;
				diskUsed = data.disk.used;
				diskPercentUsed = data.disk.percent_used;
				diskPathLabel = diskLabelPath(data.disk.path);
				diskStatsReady = true;
			} else {
				diskTotal = null;
				diskUsed = null;
				diskPercentUsed = null;
				diskPathLabel = '';
				diskStatsReady = false;
			}
		} catch {
			resetSystemStatsDisplay();
		}
	}

	onMount(() => {
		refreshSystemStats();
		statsPoll = setInterval(refreshSystemStats, 2500);
	});

	onDestroy(() => {
		if (statsPoll) clearInterval(statsPoll);
	});
</script>

<div
	class="spirit-system-dashboard flex flex-col min-h-full w-full max-w-7xl mx-auto px-3 @md:px-6 py-4 @md:py-6 gap-4 @md:gap-5 text-left"
>
	{#if $temporaryChatEnabled}
		<Tooltip
			content={$i18n.t("This chat won't appear in history and your messages will not be saved.")}
			className="w-full flex justify-start mb-0.5"
			placement="top"
		>
			<div class="flex items-center gap-2 text-gray-500 text-sm w-fit font-mono">
				<EyeSlash strokeWidth="2.5" className="size-4" />{$i18n.t('Temporary Chat')}
			</div>
		</Tooltip>
	{/if}

	<!-- Top: System Status -->
	<header
		class="rounded-none border border-[rgba(255,255,255,0.1)] backdrop-blur-md bg-black/20 dark:bg-black/30 flex flex-col @sm:flex-row @sm:items-center @sm:justify-between gap-3 w-full px-4 py-3 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
		in:fade={{ duration: 150 }}
	>
		<div class="flex items-center gap-3 min-w-0">
			<img
				src={BRANDING_LOGO_URL}
				alt=""
				class="spirit-brand-logo-glow size-10 @sm:size-11 shrink-0 object-contain"
				draggable="false"
			/>
			<div class="min-w-0 flex flex-col gap-0.5">
				<span
					class="text-xs font-mono uppercase text-slate-600 dark:text-slate-400"
					style="letter-spacing: 0.18em;"
				>
					System Status
				</span>
				<span
					class="spirit-dash-accent-text font-mono text-sm @sm:text-base font-medium truncate tabular-nums"
				>
					SPIRIT:OS v1.0.4
				</span>
			</div>
		</div>

		{#if !$selectedFolder && models.length > 0}
			<div class="flex items-center gap-2 flex-wrap justify-start @sm:justify-end">
				<span class="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">Models</span>
				<div class="flex -space-x-2">
					{#each models as model, modelIdx}
						<Tooltip
							content={(models[modelIdx]?.info?.meta?.tags ?? [])
								.map((tag) => tag.name.toUpperCase())
								.join(', ')}
							placement="top"
						>
							<button
								type="button"
								aria-hidden={models.length <= 1}
								aria-label={$i18n.t('Get information on {{name}} in the UI', {
									name: models[modelIdx]?.name
								})}
								class="ring-2 ring-white dark:ring-[#0c0c0c] rounded-full"
								on:click={() => {
									selectedModelIdx = modelIdx;
								}}
							>
								<img
									src={`${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model?.id}&lang=${$i18n.language}`}
									class="size-8 rounded-full border border-gray-200 dark:border-slate-700"
									aria-hidden="true"
									draggable="false"
									on:error={(e) => {
										e.currentTarget.src = BRANDING_LOGO_URL;
									}}
								/>
							</button>
						</Tooltip>
					{/each}
				</div>
			</div>
		{/if}
	</header>

	{#if $selectedFolder}
		<div class="shrink-0" in:fade={{ duration: 150 }}>
			<FolderTitle
				folder={$selectedFolder}
				onUpdate={async (folder) => {
					await chats.set(await getChatList(localStorage.token, $currentChatPage));
					currentChatPage.set(1);
				}}
				onDelete={async () => {
					await chats.set(await getChatList(localStorage.token, $currentChatPage));
					currentChatPage.set(1);

					selectedFolder.set(null);
				}}
			/>
		</div>

		<div
			class="flex-1 min-h-[12rem] mx-auto px-1 @md:px-2 font-primary w-full"
			in:fade={{ duration: 200, delay: 100 }}
		>
			<FolderPlaceholder folder={$selectedFolder} />
		</div>
	{:else}
		<h2
			class="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-600 dark:text-slate-400 shrink-0"
			in:fade={{ duration: 200, delay: 20 }}
		>
			Spirit OS Command Center
		</h2>

		<!-- Quick metrics -->
		<div
			class="grid grid-cols-1 @sm:grid-cols-3 gap-3 @md:gap-4 w-full shrink-0"
			in:fade={{ duration: 200, delay: 40 }}
		>
			<StatsCard title="Active Scripts" value="14" />
			<StatsCard title="Neural Latency" value="24ms" />
			<StatsCard title="GitHub Sync" value="SUCCESS" valueVariant="success" />
		</div>

		<!-- 3-column Command Center -->
		<div
			class="grid grid-cols-1 @lg:grid-cols-3 gap-3 @md:gap-4 flex-1 min-h-0 w-full"
			in:fade={{ duration: 200, delay: 50 }}
			aria-label="Spirit OS Command Center"
		>
			<!-- Column 1: Active Nodes -->
			<section
				class="rounded-none border border-[rgba(255,255,255,0.1)] backdrop-blur-md bg-black/20 dark:bg-black/30 p-4 flex flex-col gap-3 min-h-[14rem] transition-[border-color] hover:border-[rgba(34,211,238,0.22)]"
			>
				<h3 class="text-xs font-mono uppercase text-slate-600 dark:text-slate-300 tracking-[0.16em]">
					Active Nodes
				</h3>
				<ul class="flex flex-col font-mono text-sm text-slate-800 dark:text-slate-200">
					{#each activeNodes as n}
						<li
							class="flex items-center gap-3 py-2.5 border-b border-[rgba(255,255,255,0.06)] last:border-b-0"
						>
							<span class="spirit-node-led shrink-0" aria-hidden="true"></span>
							<span class="truncate">{n.name}</span>
						</li>
					{/each}
				</ul>
			</section>

			<!-- Column 2: System Traffic (CPU) -->
			<section
				class="rounded-none border border-[rgba(255,255,255,0.1)] backdrop-blur-md bg-black/20 dark:bg-black/30 p-4 flex flex-col gap-3 min-h-[14rem] transition-[border-color] hover:border-[rgba(34,211,238,0.22)]"
			>
				<h3 class="text-xs font-mono uppercase text-slate-600 dark:text-slate-300 tracking-[0.16em]">
					System Traffic
				</h3>
				<div
					class="relative flex flex-1 min-h-[9rem] items-stretch overflow-hidden rounded-none border border-[rgba(255,255,255,0.08)] bg-black/25 spirit-traffic-graph"
					role="img"
					aria-label={cpuPercent != null
						? `CPU utilization over time, current ${cpuPercent} percent`
						: 'CPU utilization chart, Calculating'}
				>
					{#if cpuHistoryPoints}
						<svg
							class="block h-full w-full min-h-[9rem]"
							viewBox="0 0 100 40"
							preserveAspectRatio="none"
						>
							<line
								x1="3"
								y1="37"
								x2="97"
								y2="37"
								stroke="rgba(148,163,184,0.35)"
								stroke-width="0.15"
								vector-effect="non-scaling-stroke"
							/>
							<polyline
								fill="none"
								stroke="#22d3ee"
								stroke-width="0.55"
								stroke-linejoin="round"
								stroke-linecap="round"
								vector-effect="non-scaling-stroke"
								class="drop-shadow-[0_0_4px_rgba(34,211,238,0.75)]"
								points={cpuHistoryPoints}
							/>
						</svg>
					{:else}
						<div
							class="flex flex-1 items-center justify-center font-mono text-[10px] uppercase tracking-wider text-slate-500"
						>
							Calculating...
						</div>
					{/if}
				</div>
				<p
					class="font-mono text-[10px] @sm:text-xs uppercase tracking-[0.12em] text-slate-600 dark:text-[#22d3ee] tabular-nums"
				>
					CPU: {cpuPercent != null ? `${cpuPercent}%` : 'Calculating...'} // RAM: {memoryPercent != null
						? `${memoryPercent}%`
						: 'Calculating...'}
				</p>
			</section>

			<!-- Column 3: Storage -->
			<section
				class="rounded-none border border-[rgba(255,255,255,0.1)] backdrop-blur-md bg-black/20 dark:bg-black/30 p-4 flex flex-col gap-4 min-h-[14rem] justify-center transition-[border-color] hover:border-[rgba(34,211,238,0.22)]"
			>
				<h3 class="text-xs font-mono uppercase text-slate-600 dark:text-slate-300 tracking-[0.14em]">
					Storage
				</h3>
				<p class="font-mono text-[11px] @sm:text-xs text-slate-700 dark:text-slate-300 leading-snug uppercase tracking-wider">
					{diskStatsReady && diskPathLabel && diskTotal != null
						? `SPIRIT_VOLUME — ${diskPathLabel} (${formatBytes(diskTotal)} total)`
						: 'SPIRIT_VOLUME — Calculating...'}
				</p>
				<div
					class="h-2.5 w-full rounded-none overflow-hidden border border-[rgba(255,255,255,0.12)] bg-black/40"
					role="img"
					aria-label={diskStatsReady && diskPercentUsed != null && diskTotal != null
						? `Disk ${diskPathLabel || 'volume'} ${diskPercentUsed.toFixed(1)} percent used`
						: 'Disk usage Calculating'}
				>
					<div
						class="h-full rounded-none bg-[#22d3ee] shadow-[0_0_12px_rgba(34,211,238,0.35)] transition-[width] duration-300 ease-out"
						style="width: {diskStatsReady && diskPercentUsed != null
							? Math.min(100, Math.max(0, diskPercentUsed))
							: 0}%"
					></div>
				</div>
				<p class="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-500">
					{diskStatsReady && diskUsed != null && diskTotal != null
						? `${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`
						: 'Calculating... / Calculating...'}
				</p>
			</section>
		</div>
	{/if}

	<!-- Command entry (integrated bottom bar) -->
	<div
		class="spirit-command-entry rounded-none border border-[rgba(255,255,255,0.1)] backdrop-blur-md bg-black/20 dark:bg-black/30 shrink-0 w-full p-2 @md:p-2.5 mt-auto transition-[border-color] hover:border-[rgba(34,211,238,0.2)]"
	>
		<div
			class="flex items-center gap-2 px-1 pb-1.5 mb-0.5 border-b border-slate-200/80 dark:border-white/10"
		>
			<span
				class="text-cyan-600 dark:text-[var(--dash-accent-cyan)] font-mono text-xs select-none drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]"
				aria-hidden="true">&gt;</span
			>
			<span
				class="text-[10px] @sm:text-xs font-mono uppercase text-slate-600 dark:text-[var(--dash-accent-violet)]"
				style="letter-spacing: 0.22em;">Command Entry</span
			>
		</div>
		<div class="pt-1 -mx-0.5">
			<MessageInput
				bind:this={messageInput}
				{history}
				{selectedModels}
				bind:files
				bind:prompt
				bind:autoScroll
				bind:selectedToolIds
				bind:selectedFilterIds
				bind:imageGenerationEnabled
				bind:codeInterpreterEnabled
				bind:webSearchEnabled
				bind:atSelectedModel
				bind:showCommands
				bind:dragged
				{pendingOAuthTools}
				{toolServers}
				{stopResponse}
				{createMessagePair}
				placeholder={$i18n.t('How can I help you today?')}
				{onChange}
				{onUpload}
				on:submit={(e) => {
					dispatch('submit', e.detail);
				}}
			/>
		</div>
	</div>

	{#if !$selectedFolder}
		<div class="mx-auto w-full max-w-3xl font-primary" in:fade={{ duration: 200, delay: 100 }}>
			<Suggestions
				suggestionPrompts={atSelectedModel?.info?.meta?.suggestion_prompts ??
					models[selectedModelIdx]?.info?.meta?.suggestion_prompts ??
					$config?.default_prompt_suggestions ??
					[]}
				inputValue={prompt}
				{onSelect}
			/>
		</div>
	{/if}
</div>

<style>
	/* Active node status LED — cyan pulse */
	.spirit-node-led {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 0;
		background: #22d3ee;
		box-shadow:
			0 0 8px #22d3ee,
			0 0 14px rgba(34, 211, 238, 0.55);
		animation: spirit-node-led-pulse 1.85s ease-in-out infinite;
	}
	@keyframes spirit-node-led-pulse {
		0%,
		100% {
			opacity: 0.65;
			transform: scale(0.92);
			box-shadow:
				0 0 4px #22d3ee,
				0 0 10px rgba(34, 211, 238, 0.35);
		}
		50% {
			opacity: 1;
			transform: scale(1);
			box-shadow:
				0 0 10px #22d3ee,
				0 0 20px rgba(34, 211, 238, 0.65);
		}
	}

	/* Tuck MessageInput chrome into command panel */
	.spirit-command-entry :global(#message-input-container) {
		border-radius: 0;
	}
</style>
