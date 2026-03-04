import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		warningFilter: (warning) => {
			// Suppress a11y warnings on canvas drag-handle divs and interactive overlays —
			// these are pointer-event-driven (not keyboard-navigable) by design.
			if (warning.code === 'a11y_click_events_have_key_events') return false;
			// startInWizard is a prop used only for initialization — intentionally captured once.
			if (warning.code === 'state_referenced_locally') return false;
			return true;
		},
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		})
	}
};

export default config;
