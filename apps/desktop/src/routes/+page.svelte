<script lang="ts">
	import { onMount, tick } from 'svelte';
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
	import { diagram } from '$lib/stores/diagram.svelte';
	import { terraform } from '$lib/stores/terraform.svelte';
	import { saveDiagram, openProject, guardUnsavedChanges } from '$lib/services/project-service';

	let showNewProjectDialog = $state(false);

	initializePlugins();

	onMount(() => {
		ui.applyTheme();
		initializeTerraformCheck();

		const appWindow = getCurrentWindow();
		const unlistenClose = appWindow.onCloseRequested(async (event) => {
			event.preventDefault();

			// Warn if terraform operation is running
			if (terraform.isRunning) {
				const proceed = await ui.confirm({
					title: 'Operation in Progress',
					message: `Terraform ${terraform.currentCommand || 'operation'} is still running. Closing the app may leave your infrastructure in an inconsistent state. Are you sure you want to close?`,
					confirmLabel: 'Close Anyway',
					cancelLabel: 'Wait',
					danger: true,
				});
				if (!proceed) return;
			}

			// Check for unsaved changes
			if (project.isOpen && project.isDirty) {
				const result = await ui.confirmUnsaved();
				if (result === 'cancel') return;
				if (result === 'save') await saveDiagram();
			}
			await appWindow.destroy();
		});

		async function handleKeydown(e: KeyboardEvent) {
			const tag = (e.target as HTMLElement).tagName;
			const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

			if (e.ctrlKey && e.key === 's') {
				e.preventDefault();
				if (project.isOpen) saveDiagram();
				return;
			}
			if (e.ctrlKey && e.key === 'b') {
				e.preventDefault();
				ui.showSidePanel = !ui.showSidePanel;
				return;
			}
			if (e.ctrlKey && e.key === '`') {
				e.preventDefault();
				ui.toggleTerminal();
				return;
			}
			if (e.ctrlKey && e.key === 'n' && !inInput) {
				e.preventDefault();
				showNewProjectDialog = true;
				return;
			}
			if (e.ctrlKey && e.key === 'o' && !inInput) {
				e.preventDefault();
				try { await openProject(); } catch { /* cancelled */ }
				return;
			}
			if (e.ctrlKey && !e.shiftKey && e.key === 'w' && !inInput) {
				e.preventDefault();
				if (project.isOpen && ui.activeTabId !== 'canvas') {
					ui.closeTab(ui.activeTabId);
				}
				return;
			}
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'w' && !inInput) {
				e.preventDefault();
				if (project.isOpen) {
					if (!(await guardUnsavedChanges())) return;
					diagram.clear();
					project.close();
				}
				return;
			}
			if (e.ctrlKey && e.key === 'f' && !inInput) {
				e.preventDefault();
				if (!ui.showSidePanel) ui.showSidePanel = true;
				await tick();
				const searchInput = document.querySelector<HTMLInputElement>('.side-panel .search-input');
				searchInput?.focus();
				searchInput?.select();
				return;
			}
			if (e.ctrlKey && e.key === '0' && !inInput) {
				e.preventDefault();
				if (project.isOpen) ui.fitView?.();
				return;
			}

			if (e.altKey && e.key === '1' && !inInput) {
				e.preventDefault();
				ui.setActiveView('explorer');
				return;
			}
			if (e.altKey && e.key === '2' && !inInput) {
				e.preventDefault();
				ui.setActiveView('terraform');
				return;
			}
			if (e.altKey && e.key === '3' && !inInput) {
				e.preventDefault();
				ui.setActiveView('settings');
				return;
			}
			if (e.ctrlKey && e.key === ',' && !inInput) {
				e.preventDefault();
				ui.setActiveView('app-settings');
				return;
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
	<WelcomeScreen />
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
