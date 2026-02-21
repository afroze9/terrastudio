<script lang="ts">
	import { onMount } from 'svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { initializePlugins, initializeTerraformCheck } from '$lib/bootstrap';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import ActivityBar from '$lib/components/ActivityBar.svelte';
	import SidePanel from '$lib/components/SidePanel.svelte';
	import EditorArea from '$lib/components/EditorArea.svelte';
	import PropertiesPanel from '$lib/components/PropertiesPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import NewProjectDialog from '$lib/components/NewProjectDialog.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import UnsavedChangesDialog from '$lib/components/UnsavedChangesDialog.svelte';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { project } from '$lib/stores/project.svelte';
	import { saveDiagram } from '$lib/services/project-service';

	let showNewProjectDialog = $state(false);

	initializePlugins();

	onMount(() => {
		ui.applyTheme();
		initializeTerraformCheck();

		const appWindow = getCurrentWindow();
		const unlistenClose = appWindow.onCloseRequested(async (event) => {
			event.preventDefault();
			if (project.isOpen && project.isDirty) {
				const result = await ui.confirmUnsaved();
				if (result === 'cancel') return;
				if (result === 'save') await saveDiagram();
			}
			await appWindow.destroy();
		});

		function handleKeydown(e: KeyboardEvent) {
			if (e.ctrlKey && e.key === 's') {
				e.preventDefault();
				if (project.isOpen) saveDiagram();
			}
			if (e.ctrlKey && e.key === 'b') {
				e.preventDefault();
				ui.showSidePanel = !ui.showSidePanel;
			}
			if (e.ctrlKey && e.key === 'j') {
				e.preventDefault();
				ui.toggleTerminal();
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => {
			unlistenClose.then((fn) => fn());
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if project.isOpen}
	<div class="app-shell">
		<Titlebar onNewProject={() => (showNewProjectDialog = true)} />
		<div class="main-body">
			<ActivityBar />
			{#if ui.showSidePanel}
				<SidePanel />
			{/if}
			<EditorArea />
			{#if ui.showPropertiesPanel}
				<PropertiesPanel />
			{/if}
		</div>
		<StatusBar />
	</div>
{:else}
	<WelcomeScreen onNewProject={() => (showNewProjectDialog = true)} />
{/if}

<NewProjectDialog
	open={showNewProjectDialog}
	onclose={() => (showNewProjectDialog = false)}
/>
<ConfirmDialog />
<UnsavedChangesDialog />

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}
	.main-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}
</style>
