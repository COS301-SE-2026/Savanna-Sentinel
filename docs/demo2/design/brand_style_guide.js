if (typeof lucide !== "undefined") lucide.createIcons();

function _wcagLin(c) {
	c /= 255;
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function _wcagLum(color) {
	color = color.trim();
	let r, g, b;
	const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (rgb) {
		r = Number.parseInt(rgb[1]);
		g = Number.parseInt(rgb[2]);
		b = Number.parseInt(rgb[3]);
	} else {
		const hex = color.replace(/^#/, "");
		const h =
			hex.length === 3
				? hex
						.split("")
						.map(function (c) {
							return c + c;
						})
						.join("")
				: hex;
		r = Number.parseInt(h.slice(0, 2), 16);
		g = Number.parseInt(h.slice(2, 4), 16);
		b = Number.parseInt(h.slice(4, 6), 16);
	}
	return 0.2126 * _wcagLin(r) + 0.7152 * _wcagLin(g) + 0.0722 * _wcagLin(b);
}
function _wcagContrast(hex1, hex2) {
	let L1 = _wcagLum(hex1),
		L2 = _wcagLum(hex2);
	if (L1 < L2) {
		const t = L1;
		L1 = L2;
		L2 = t;
	}
	return (L1 + 0.05) / (L2 + 0.05);
}
const _cs = getComputedStyle(document.documentElement);
document.querySelectorAll(".auto-ratio").forEach(function (span) {
	const fg = _cs.getPropertyValue(span.dataset.fg).trim();
	const bg = _cs.getPropertyValue(span.dataset.bg).trim();
	if (fg && bg) {
		const ratio = _wcagContrast(fg, bg);
		span.dataset.ratio = ratio;
		span.textContent = (Math.floor(ratio * 10) / 10).toFixed(1) + ":1";
	}
});

document.querySelectorAll(".contrast-table tbody tr").forEach(function (row) {
	const ratioSpan = row.querySelector(".auto-ratio");
	if (!ratioSpan) return;
	const r = Number.parseFloat(ratioSpan.dataset.ratio);
	if (Number.isNaN(r)) return;
	let badge;
	if (r >= 7) badge = '<span class="pass-badge">AAA</span>';
	else if (r >= 4.5) badge = '<span class="warn-badge">AAA large text</span>';
	else if (r >= 3) badge = '<span class="warn-badge">Large text only</span>';
	else badge = '<span class="warn-badge">Decorative only</span>';
	row.cells[4].innerHTML = badge;
});

const navLinks = document.querySelectorAll(".site-nav a");

const observer = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				navLinks.forEach((a) => a.classList.remove("active"));
				const active = document.querySelector(
					`.site-nav a[href="#${entry.target.id}"]`,
				);
				if (active) active.classList.add("active");
			}
		});
	},
	{ rootMargin: "-30% 0px -60% 0px" },
);

document.querySelectorAll("section[id]").forEach((s) => observer.observe(s));

document.querySelectorAll(".colour-role-card[data-hex]").forEach((card) => {
	card.querySelector(".colour-swatch").style.background =
		card.dataset.bg || card.dataset.hex;
	card.setAttribute("tabindex", "0");
	card.setAttribute("role", "button");

	function copyHex() {
		if (!navigator.clipboard) return;
		const hex = card.dataset.hex;
		navigator.clipboard
			.writeText(hex)
			.then(() => {
				const hint = card.querySelector(".colour-copy-hint");
				hint.textContent = "Copied!";
				hint.style.opacity = "1";
				setTimeout(() => {
					hint.textContent = "Copy hex";
					hint.style.opacity = "";
				}, 1500);
			})
			.catch(() => {});
	}

	card.addEventListener("click", copyHex);
	card.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			copyHex();
		}
	});
});

document.querySelectorAll(".topbar-offline-btn").forEach(function (btn) {
	btn.addEventListener("click", function (e) {
		e.stopPropagation();
		const popover = btn.querySelector(".offline-popover");
		const opening = !popover.classList.contains("is-open");
		document.querySelectorAll(".offline-popover.is-open").forEach(function (t) {
			t.classList.remove("is-open");
		});
		if (opening) {
			popover.classList.add("is-open");
			btn.setAttribute("aria-expanded", "true");
		} else {
			btn.setAttribute("aria-expanded", "false");
		}
	});
});

document.addEventListener("click", function () {
	document.querySelectorAll(".offline-popover.is-open").forEach(function (t) {
		t.classList.remove("is-open");
	});
	document.querySelectorAll(".topbar-offline-btn").forEach(function (btn) {
		btn.setAttribute("aria-expanded", "false");
	});
});

document.addEventListener("keydown", function (e) {
	if (e.key === "Escape") {
		document.querySelectorAll(".offline-popover.is-open").forEach(function (t) {
			t.classList.remove("is-open");
		});
		document.querySelectorAll(".topbar-offline-btn").forEach(function (btn) {
			btn.setAttribute("aria-expanded", "false");
		});
	}
});

document
	.querySelectorAll(".form-toggle:not([disabled])")
	.forEach(function (toggle) {
		toggle.addEventListener("click", function () {
			const isOn = this.getAttribute("aria-checked") === "true";
			this.setAttribute("aria-checked", isOn ? "false" : "true");
			this.classList.toggle("is-on", !isOn);
		});
	});

document.querySelectorAll(".form-toggle-wrapper").forEach(function (wrapper) {
	const toggle = wrapper.querySelector(".form-toggle:not([disabled])");
	if (!toggle) return;
	wrapper.addEventListener("click", function (e) {
		if (toggle.contains(e.target)) return;
		toggle.click();
	});
});

const indeterminateCheckbox = document.getElementById("demo-cb-indeterminate");
if (indeterminateCheckbox) {
	indeterminateCheckbox.indeterminate = true;
	let indeterminateCheckboxState = 0;
	indeterminateCheckbox.addEventListener("change", function () {
		indeterminateCheckboxState = (indeterminateCheckboxState + 1) % 3;
		if (indeterminateCheckboxState === 0) {
			this.checked = false;
			this.indeterminate = true;
		} else if (indeterminateCheckboxState === 1) {
			this.checked = true;
			this.indeterminate = false;
		} else {
			this.checked = false;
			this.indeterminate = false;
		}
	});
}

(function () {
	const layerToggle = document.getElementById("heatmap-layer-toggle");
	const opacityWrapper = document.getElementById("heatmap-opacity-wrapper");
	if (!layerToggle || !opacityWrapper) return;
	const opacityThumb = opacityWrapper.querySelector(".form-range-thumb");

	function setLayerOn(isOn) {
		opacityWrapper.classList.toggle("is-disabled", !isOn);
		if (opacityThumb) opacityThumb.tabIndex = isOn ? 0 : -1;
	}

	layerToggle.addEventListener("change", function () {
		setLayerOn(layerToggle.checked);
	});
})();

const SLIDER_SNAPSHOTS = [
	"15 Jan 2025",
	"15 Mar 2025",
	"1 May 2025",
	"15 Jun 2025",
	"1 Aug 2025",
	"15 Sep 2025",
	"1 Nov 2025",
	"15 Dec 2025",
	"1 Mar 2026",
	"14 May 2026",
];

document
	.querySelectorAll(".form-range-wrapper:not(.is-disabled)")
	.forEach(function (wrapper) {
		const thumb = wrapper.querySelector(".form-range-thumb");
		const fill = wrapper.querySelector(".form-range-fill");
		const track = wrapper.querySelector(".form-range-track");
		const valueLabel = wrapper.querySelector(".form-range-value");
		const hint = wrapper.querySelector(".form-range-hint");
		if (!thumb || !fill || !track) return;

		const isSnapshots = wrapper.dataset.type === "snapshots";
		const snapshotSelect = isSnapshots
			? wrapper.parentElement.querySelector(".form-select-wrapper select")
			: null;
		const min = Number.parseFloat(wrapper.dataset.min || "0");
		const max = Number.parseFloat(wrapper.dataset.max || "100");
		const step = Number.parseFloat(wrapper.dataset.step || "1");

		function isDisabled() {
			return wrapper.classList.contains("is-disabled");
		}

		function pctFromX(clientX) {
			const rect = track.getBoundingClientRect();
			const raw = (clientX - rect.left) / rect.width;
			return Math.min(1, Math.max(0, raw));
		}

		function applySnapshot(idx) {
			idx = Math.min(SLIDER_SNAPSHOTS.length - 1, Math.max(0, idx));
			const pct = idx / (SLIDER_SNAPSHOTS.length - 1);
			fill.style.width = pct * 100 + "%";
			thumb.style.left = pct * 100 + "%";
			thumb.setAttribute("aria-valuenow", idx);
			thumb.setAttribute("aria-valuetext", SLIDER_SNAPSHOTS[idx]);
			if (hint) hint.textContent = "Snapshot: " + SLIDER_SNAPSHOTS[idx];
			if (snapshotSelect) snapshotSelect.value = idx;
		}

		function applyPct(rawPct) {
			let value = min + rawPct * (max - min);
			value = Math.round(value / step) * step;
			value = Math.min(max, Math.max(min, value));
			const posPct = ((value - min) / (max - min)) * 100;
			fill.style.width = posPct + "%";
			thumb.style.left = posPct + "%";
			thumb.setAttribute("aria-valuenow", value);
			if (valueLabel) valueLabel.textContent = value + "%";
		}

		function onMove(e) {
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const pct = pctFromX(clientX);
			if (isSnapshots) {
				applySnapshot(Math.round(pct * (SLIDER_SNAPSHOTS.length - 1)));
			} else {
				applyPct(pct);
			}
		}

		function onUp() {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			document.removeEventListener("touchmove", onMove);
			document.removeEventListener("touchend", onUp);
		}

		thumb.addEventListener("mousedown", function (e) {
			if (isDisabled()) return;
			e.preventDefault();
			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		});

		thumb.addEventListener(
			"touchstart",
			function (e) {
				if (isDisabled()) return;
				e.preventDefault();
				document.addEventListener("touchmove", onMove, { passive: false });
				document.addEventListener("touchend", onUp);
			},
			{ passive: false },
		);

		track.addEventListener("click", function (e) {
			if (isDisabled() || e.target === thumb) return;
			const pct = pctFromX(e.clientX);
			if (isSnapshots) {
				applySnapshot(Math.round(pct * (SLIDER_SNAPSHOTS.length - 1)));
			} else {
				applyPct(pct);
			}
		});

		if (snapshotSelect) {
			snapshotSelect.addEventListener("change", function () {
				applySnapshot(Number.parseInt(this.value, 10));
			});
		}

		thumb.addEventListener("keydown", function (e) {
			if (isDisabled()) return;
			if (isSnapshots) {
				const idx = Number.parseInt(thumb.getAttribute("aria-valuenow") || "0", 10);
				if (e.key === "ArrowRight" || e.key === "ArrowUp") {
					e.preventDefault();
					applySnapshot(idx + 1);
				} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
					e.preventDefault();
					applySnapshot(idx - 1);
				} else if (e.key === "Home") {
					e.preventDefault();
					applySnapshot(0);
				} else if (e.key === "End") {
					e.preventDefault();
					applySnapshot(SLIDER_SNAPSHOTS.length - 1);
				}
			} else {
				const current = Number.parseFloat(
					thumb.getAttribute("aria-valuenow") || String(min),
				);
				if (e.key === "ArrowRight" || e.key === "ArrowUp") {
					e.preventDefault();
					applyPct((Math.min(max, current + step) - min) / (max - min));
				} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
					e.preventDefault();
					applyPct((Math.max(min, current - step) - min) / (max - min));
				} else if (e.key === "Home") {
					e.preventDefault();
					applyPct(0);
				} else if (e.key === "End") {
					e.preventDefault();
					applyPct(1);
				}
			}
		});
	});

document.querySelectorAll(".form-textarea[maxlength]").forEach(function (ta) {
	const counter = document.querySelector(
		".form-char-count[data-for='" + ta.id + "']",
	);
	if (!counter) return;
	const max = ta.getAttribute("maxlength");
	counter.textContent = ta.value.length + " / " + max;
	ta.addEventListener("input", function () {
		counter.textContent = this.value.length + " / " + max;
	});
});

const _openMultiselects = [];

function _repositionOpenMultiselects() {
	_openMultiselects.forEach(function (m) {
		if (!m.panel.hidden) m.positionPanel();
	});
}
window.addEventListener("scroll", _repositionOpenMultiselects, true);
window.addEventListener("resize", _repositionOpenMultiselects);

document.querySelectorAll(".form-multiselect").forEach(function (wrapper) {
	const trigger = wrapper.querySelector(".form-multiselect-trigger");
	const panel = wrapper.querySelector(".form-multiselect-panel");
	const summary = wrapper.querySelector(".form-multiselect-summary");
	if (!trigger || !panel || !summary) return;

	function positionPanel() {
		const rect = trigger.getBoundingClientRect();
		panel.style.top = rect.bottom + 4 + "px";
		panel.style.left = rect.left + "px";
		panel.style.width = rect.width + "px";
	}

	function closePanel() {
		panel.hidden = true;
		trigger.classList.remove("is-open");
		trigger.setAttribute("aria-expanded", "false");
	}

	function openPanel() {
		document.querySelectorAll(".form-multiselect-panel").forEach(function (p) {
			if (p !== panel) p.hidden = true;
		});
		document
			.querySelectorAll(".form-multiselect-trigger")
			.forEach(function (t) {
				if (t !== trigger) {
					t.classList.remove("is-open");
					t.setAttribute("aria-expanded", "false");
				}
			});
		positionPanel();
		panel.hidden = false;
		trigger.classList.add("is-open");
		trigger.setAttribute("aria-expanded", "true");
	}

	_openMultiselects.push({ panel: panel, positionPanel: positionPanel });

	function updateSummary() {
		const checked = Array.prototype.slice.call(
			panel.querySelectorAll(".form-checkbox-input:checked"),
		);
		summary.classList.remove("is-placeholder");
		if (checked.length === 0) {
			summary.textContent = "None Selected";
			summary.classList.add("is-placeholder");
		} else if (checked.length === 1) {
			summary.textContent = checked[0]
				.closest(".form-multiselect-option")
				.querySelector(".form-label-text").textContent;
		} else {
			summary.textContent = checked.length + " selected";
		}
	}

	trigger.addEventListener("click", function (e) {
		e.stopPropagation();
		if (panel.hidden) {
			openPanel();
		} else {
			closePanel();
		}
	});

	panel.querySelectorAll(".form-checkbox-input").forEach(function (checkbox) {
		checkbox.addEventListener("change", updateSummary);
	});
});

document.addEventListener("click", function (e) {
	document.querySelectorAll(".form-multiselect").forEach(function (wrapper) {
		if (wrapper.contains(e.target)) return;
		const trigger = wrapper.querySelector(".form-multiselect-trigger");
		const panel = wrapper.querySelector(".form-multiselect-panel");
		if (panel && !panel.hidden) {
			panel.hidden = true;
			trigger.classList.remove("is-open");
			trigger.setAttribute("aria-expanded", "false");
		}
	});
});

document.addEventListener("keydown", function (e) {
	if (e.key !== "Escape") return;
	document
		.querySelectorAll(".form-multiselect-panel:not([hidden])")
		.forEach(function (panel) {
			const wrapper = panel.closest(".form-multiselect");
			const trigger = wrapper.querySelector(".form-multiselect-trigger");
			panel.hidden = true;
			trigger.classList.remove("is-open");
			trigger.setAttribute("aria-expanded", "false");
			trigger.focus();
		});
});

(function () {
	const panel = document.getElementById("analysis-panel");
	const closeX = document.getElementById("analysis-panel-close-x");
	const closeBtn = document.getElementById("analysis-panel-close-btn");
	const reopenBtn = document.getElementById("analysis-panel-reopen");
	if (!panel || !closeX || !closeBtn || !reopenBtn) return;

	function closePanel() {
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduceMotion) {
			panel.hidden = true;
			reopenBtn.hidden = false;
			return;
		}
		panel.classList.add("is-closing");
		panel.addEventListener("animationend", function done() {
			panel.hidden = true;
			panel.classList.remove("is-closing");
			panel.removeEventListener("animationend", done);
			reopenBtn.hidden = false;
		});
	}

	function openPanel() {
		reopenBtn.hidden = true;
		panel.hidden = false;
		panel.classList.remove("is-closing");
	}

	closeX.addEventListener("click", closePanel);
	closeBtn.addEventListener("click", closePanel);
	reopenBtn.addEventListener("click", openPanel);
})();

(function () {
	const trigger = document.getElementById("modal-demo-trigger");
	const overlay = document.getElementById("modal-demo-overlay");
	if (!trigger || !overlay) return;
	const modal = document.getElementById("modal-demo");
	const closeBtn = document.getElementById("modal-demo-close");
	const cancelBtn = document.getElementById("modal-demo-cancel");
	let lastFocused = null;

	function focusableEls() {
		return modal.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
	}

	function onKeydown(e) {
		if (e.key === "Escape") {
			closeModal();
			return;
		}
		if (e.key !== "Tab") return;
		const focusable = Array.prototype.slice.call(focusableEls());
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable.at(-1);
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function openModal() {
		lastFocused = document.activeElement;
		overlay.hidden = false;
		overlay.classList.remove("is-closing");
		closeBtn.focus();
		document.addEventListener("keydown", onKeydown);
	}

	function closeModal() {
		document.removeEventListener("keydown", onKeydown);
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduceMotion) {
			overlay.hidden = true;
			if (lastFocused) lastFocused.focus();
			return;
		}
		overlay.classList.add("is-closing");
		overlay.addEventListener("animationend", function done() {
			overlay.hidden = true;
			overlay.classList.remove("is-closing");
			overlay.removeEventListener("animationend", done);
			if (lastFocused) lastFocused.focus();
		});
	}

	trigger.addEventListener("click", openModal);
	closeBtn.addEventListener("click", closeModal);
	cancelBtn.addEventListener("click", closeModal);
	overlay.addEventListener("click", function (e) {
		if (e.target === overlay && overlay.dataset.dismissOnBackdrop !== "false") {
			closeModal();
		}
	});
})();
