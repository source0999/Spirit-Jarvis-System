<script lang="ts">
	/** Metric label (uppercased visually via styles). */
	export let title: string;
	/** Primary reading (e.g. count, latency, status). */
	export let value: string;
	/** Optional tone for status-style values. */
	export let valueVariant: 'default' | 'success' = 'default';
</script>

<div
	class="rounded-none border border-[rgba(255,255,255,0.1)] backdrop-blur-md bg-black/20 dark:bg-black/30 px-4 py-3 flex flex-col gap-1 min-w-0 transition-[border-color,box-shadow] hover:border-[rgba(34,211,238,0.25)]"
	role="group"
	aria-label={`${title}: ${value}`}
>
	<span
		class="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 truncate"
		style="letter-spacing: 0.16em;"
	>
		{title}
	</span>
	<span
		class="font-mono text-lg @sm:text-xl font-semibold tabular-nums truncate leading-tight {valueVariant ===
		'success'
			? 'text-emerald-700 dark:text-emerald-400'
			: 'text-slate-900 dark:text-slate-100'}"
	>
		{value}
	</span>
</div>
