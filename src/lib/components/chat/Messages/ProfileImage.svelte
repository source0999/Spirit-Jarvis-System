<script lang="ts">
	import { WEBUI_BASE_URL, BRANDING_LOGO_URL } from '$lib/constants';

	export let className = 'size-8';
	export let src = BRANDING_LOGO_URL;
</script>

<img
	aria-hidden="true"
	src={src === ''
		? BRANDING_LOGO_URL
		: src.startsWith(WEBUI_BASE_URL) ||
			  src.startsWith('https://www.gravatar.com/avatar/') ||
			  src.startsWith('data:') ||
			  src.startsWith('/')
			? src
			: `${WEBUI_BASE_URL}/user.png`}
	class=" {className} object-cover rounded-full"
	alt="profile"
	draggable="false"
/>
