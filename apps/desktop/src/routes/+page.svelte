<script lang="ts">
	import { initializePlugins } from '$lib/bootstrap';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import ResourcePalette from '$lib/components/ResourcePalette.svelte';
	import Canvas from '$lib/components/Canvas.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TerraformPanel from '$lib/components/TerraformPanel.svelte';
	import { ui } from '$lib/stores/ui.svelte';

	initializePlugins();
</script>

<div class="app-shell">
	<Toolbar />
	<div class="app-body">
		{#if ui.showPalette}
			<ResourcePalette />
		{/if}
		<div class="main-area">
			<Canvas />
			<TerraformPanel />
		</div>
		{#if ui.showSidebar}
			<Sidebar />
		{/if}
	</div>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}
	.app-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.main-area {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
</style>
