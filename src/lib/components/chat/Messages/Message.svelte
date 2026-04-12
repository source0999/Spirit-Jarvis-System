<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	const messageSlideIn = () => {
		if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return { y: 0, duration: 0, opacity: 1, easing: cubicOut };
		}
		return { y: 14, duration: 380, opacity: 0, easing: cubicOut };
	};

	import { settings } from '$lib/stores';

	import MultiResponseMessages from './MultiResponseMessages.svelte';
	import ResponseMessage from './ResponseMessage.svelte';
	import UserMessage from './UserMessage.svelte';

	export let chatId;
	export let selectedModels = [];
	export let idx = 0;

	export let history;
	export let messageId;

	export let user;

	export let setInputText: Function = () => {};
	export let gotoMessage;
	export let showPreviousMessage;
	export let showNextMessage;
	export let updateChat;

	export let editMessage;
	export let saveMessage;
	export let deleteMessage;
	export let rateMessage;
	export let actionMessage;
	export let submitMessage;

	export let regenerateResponse;
	export let continueResponse;
	export let mergeResponses;

	export let addMessages;
	export let triggerScroll;
	export let readOnly = false;
	export let editCodeBlock = true;
	export let topPadding = false;
</script>

<div
	role="listitem"
	in:fly={messageSlideIn()}
	class="chat-message-log group flex w-full flex-col justify-between {($settings?.widescreenMode ?? null)
		? 'max-w-full'
		: 'max-w-5xl'} mx-auto mb-5 px-3 sm:px-4"
>
	{#if history.messages[messageId]}
		{#if history.messages[messageId].role === 'user'}
			<UserMessage
				{user}
				{chatId}
				{history}
				{messageId}
				isFirstMessage={idx === 0}
				siblings={history.messages[messageId].parentId !== null
					? (history.messages[history.messages[messageId].parentId]?.childrenIds ?? [])
					: (Object.values(history.messages)
							.filter((message) => message.parentId === null)
							.map((message) => message.id) ?? [])}
				{gotoMessage}
				{showPreviousMessage}
				{showNextMessage}
				{editMessage}
				{deleteMessage}
				{readOnly}
				{editCodeBlock}
				{topPadding}
			/>
		{:else if (history.messages[history.messages[messageId].parentId]?.models?.length ?? 1) === 1}
			<ResponseMessage
				{chatId}
				{history}
				{messageId}
				{selectedModels}
				isLastMessage={messageId === history.currentId}
				siblings={history.messages[history.messages[messageId].parentId]?.childrenIds ?? []}
				{setInputText}
				{gotoMessage}
				{showPreviousMessage}
				{showNextMessage}
				{updateChat}
				{editMessage}
				{saveMessage}
				{rateMessage}
				{actionMessage}
				{submitMessage}
				{deleteMessage}
				{continueResponse}
				{regenerateResponse}
				{addMessages}
				{readOnly}
				{editCodeBlock}
				{topPadding}
			/>
		{:else}
			{#key messageId}
				<MultiResponseMessages
					bind:history
					{chatId}
					{messageId}
					{selectedModels}
					isLastMessage={messageId === history?.currentId}
					{setInputText}
					{updateChat}
					{editMessage}
					{saveMessage}
					{rateMessage}
					{actionMessage}
					{submitMessage}
					{deleteMessage}
					{continueResponse}
					{regenerateResponse}
					{mergeResponses}
					{triggerScroll}
					{addMessages}
					{readOnly}
					{editCodeBlock}
					{topPadding}
				/>
			{/key}
		{/if}
	{/if}
</div>
