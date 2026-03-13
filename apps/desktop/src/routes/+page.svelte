<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { declarePlugins, initializeTerraformCheck, initLogging, initValidation } from '$lib/bootstrap';
	import { i18n } from '$lib/i18n';
	import Titlebar from '$lib/components/Titlebar.svelte';
	import ActivityBar from '$lib/components/ActivityBar.svelte';
	import SidePanel from '$lib/components/SidePanel.svelte';
	import EditorArea from '$lib/components/EditorArea.svelte';
	import PropertiesPanel from '$lib/components/PropertiesPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import UnsavedChangesDialog from '$lib/components/UnsavedChangesDialog.svelte';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import { project } from '$lib/stores/project.svelte';
	import { diagram } from '$lib/stores/diagram.svelte';
	import { terraform } from '$lib/stores/terraform.svelte';
	import { plan } from '$lib/stores/plan.svelte';
	import { saveDiagram, openProject, guardUnsavedChanges, initWindowProject, initFileAssociationHandler } from '$lib/services/project-service';
	import { destroyBridgeListener } from '$lib/mcp/bridge-listener';
	import { initSettingsSync, destroySettingsSync } from '$lib/stores/settings-sync';

	let startWelcomeInWizard = $state(false);

	/** Close the current project and go to the welcome screen's new project wizard. */
	async function handleNewProject() {
		if (project.isOpen) {
			if (!(await guardUnsavedChanges())) return;
			diagram.clear();
			terraform.clear();
			plan.clear();
			ui.closeAllFileTabs();
			project.close();
			const win = getCurrentWindow();
			win.setTitle('TerraStudio').catch(() => {});
			invoke('mcp_set_window_project', {
				windowLabel: win.label,
				projectName: '',
				projectPath: '',
			}).catch(() => {});
		}
		// Signal the welcome screen to go straight into the wizard
		startWelcomeInWizard = true;
	}

	declarePlugins();

	onMount(() => {
		i18n.init().catch(console.warn);
		ui.applyTheme();
		const appWindow = getCurrentWindow();
		initLogging(ui.logLevel);
		initializeTerraformCheck();
		initValidation();
		initWindowProject();
		initFileAssociationHandler();
		initSettingsSync();

		// Track active window for MCP targeting
		const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
			if (focused) invoke('mcp_set_active_window', { windowLabel: appWindow.label }).catch(() => {});
		});

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

			// Unregister from MCP state and clean up listeners before destroying
			destroySettingsSync();
			destroyBridgeListener();
			await appWindow.destroy();
		});

		async function handleKeydown(e: KeyboardEvent) {
			// Block browser refresh (F5, Ctrl+R)
			if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
				e.preventDefault();
				return;
			}

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
				ui.toggleBottomPanel('terminal');
				return;
			}
			if (e.ctrlKey && !e.shiftKey && e.key === 'j' && !inInput) {
				e.preventDefault();
				ui.showBottomPanel = !ui.showBottomPanel;
				return;
			}
			if (e.ctrlKey && e.shiftKey && e.key === 'M' && !inInput) {
				e.preventDefault();
				ui.toggleBottomPanel('problems');
				return;
			}
			if (e.ctrlKey && e.shiftKey && e.key === 'F' && !inInput) {
				e.preventDefault();
				ui.setActiveView('search');
				return;
			}
			if (e.ctrlKey && e.shiftKey && e.key === 'N' && !inInput) {
				e.preventDefault();
				invoke('create_project_window', {}).catch(() => {});
				return;
			}
			if (e.ctrlKey && !e.shiftKey && e.key === 'n' && !inInput) {
				e.preventDefault();
				handleNewProject();
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
					terraform.clear();
					ui.closeAllFileTabs();
					startWelcomeInWizard = false;
					project.close();
					const win = getCurrentWindow();
					win.setTitle('TerraStudio').catch(() => {});
					// Clear MCP project metadata (window stays registered, just no project)
					invoke('mcp_set_window_project', {
						windowLabel: win.label,
						projectName: '',
						projectPath: '',
					}).catch(() => {});
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
			if (e.altKey && e.key === '4' && !inInput) {
				e.preventDefault();
				ui.setActiveView('cost');
				return;
			}
			if (e.altKey && e.key === '5' && !inInput) {
				e.preventDefault();
				ui.setActiveView('search');
				return;
			}
			if (e.ctrlKey && e.key === ',' && !inInput) {
				e.preventDefault();
				ui.setActiveView('app-settings');
				return;
			}
		}

		// Block browser right-click context menu globally.
		// Custom context menus (TabBar, DnDFlow, TerraformSidebar) are Svelte components
		// and are unaffected — they only use preventDefault() on the native event to
		// suppress the browser menu, which this handler also does.
		function blockContextMenu(e: MouseEvent) {
			const tag = (e.target as HTMLElement).tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
			e.preventDefault();
		}

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('contextmenu', blockContextMenu);
		return () => {
			unlistenClose.then((fn) => fn());
			unlistenFocus.then((fn) => fn());
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('contextmenu', blockContextMenu);
		};
	});
</script>

{#if project.isOpen}
	<div class="app-shell">
		<Titlebar onNewProject={handleNewProject} />
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
	<WelcomeScreen startInWizard={startWelcomeInWizard} />
{/if}

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
