<script lang="ts">
	import { onMount } from 'svelte';
	import { initializePlugins, initializeTerraformCheck } from '$lib/bootstrap';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import ResourcePalette from '$lib/components/ResourcePalette.svelte';
	import Canvas from '$lib/components/Canvas.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TerraformPanel from '$lib/components/TerraformPanel.svelte';
	import NewProjectDialog from '$lib/components/NewProjectDialog.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { project } from '$lib/stores/project.svelte';
	import { saveDiagram } from '$lib/services/project-service';

	let showNewProjectDialog = $state(false);

	initializePlugins();

	onMount(() => {
		initializeTerraformCheck();

		function handleKeydown(e: KeyboardEvent) {
			if (e.ctrlKey && e.key === 's') {
				e.preventDefault();
				if (project.isOpen) {
					saveDiagram();
				}
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<div class="app-shell">
	<Toolbar onNewProject={() => (showNewProjectDialog = true)} />
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

<NewProjectDialog
	open={showNewProjectDialog}
	onclose={() => (showNewProjectDialog = false)}
/>

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
