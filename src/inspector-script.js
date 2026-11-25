/**
* @preserve
* Filename: inspector-script.js
*/
((config) => {

	const regions = new WeakMap();
	const stack = [];

	// individua i blocchi delimitati dai commenti DEBUG INSPECTOR
	// https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker
	// eslint-disable-next-line no-bitwise
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);

	while (walker.nextNode()) {

		const node = walker.currentNode;

		if (node.nodeType === Node.COMMENT_NODE) {

			const match = node.nodeValue.trim().match(/^DEBUG INSPECTOR:(START|END)\s+(.+)$/);

			if (!match) continue;

			const [, type, path] = match;

			if (type === "START") {

				stack.push({
					path,
					"start": node,
					"range": null
				});

			} else {

				const region = stack[stack.length - 1];

				if (!region || region.path !== path) {

					console.error("Eleventy Debug Inspector: mismatched comments", path);
					continue;
				}

				const range = document.createRange();

				range.setStartAfter(region.start);
				range.setEndBefore(node);

				region.range = range;
				stack.pop();
			}

			continue;
		}

		// associa ogni elemento al blocco DEBUG INSPECTOR più interno
		if (stack.length > 0) {

			regions.set(node, stack[stack.length - 1]);
		}
	}

	// elemento grafico che evidenzia il blocco
	const highlight = document.createElement("div");
	// etichetta del template
	const label = document.createElement("div");
	// indicatore visivo dello stato attivo
	const statusIcon = document.createElement("div");
	// immagine carina che rende felici adulti e piccini
	const statusIconImage = document.createElement("img");

	highlight.style.cssText = `
		position: fixed;
		z-index: 2147483647;
		pointer-events: none;
		border: 2px solid ${config["overlayBorderColor"]};
		background: ${config["overlayBackgroundColor"]};
		box-sizing: border-box;
		display: none;
	`;

	label.style.cssText = `
		position: fixed;
		z-index: 2147483647;
		pointer-events: none;
		background: ${config["labelBackgroundColor"]};
		color: ${config["labelTextColor"]};
		padding: 5px 9px;
		font: ${config["labelFontSize"]} monospace;
		border-radius: 4px;
		display: none;
		max-width: 90vw;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`;

	statusIcon.setAttribute("role", "status");
	statusIcon.setAttribute("aria-label", "Eleventy Debug Inspector active");
	statusIcon.style.cssText = `
		position: fixed;
		left: 12px;
		bottom: 12px;
		z-index: 2147483647;
		width: 40px;
		height: 40px;
		pointer-events: none;
		filter: drop-shadow(0 4px 7px rgb(0 0 0 / 25%));
		display: none;
	`;

	statusIconImage.src = config["iconSrc"];
	statusIconImage.alt = "";
	statusIconImage.width = 40;
	statusIconImage.height = 40;
	statusIconImage.setAttribute("aria-hidden", "true");
	statusIcon.append(statusIconImage);

	document.body.append(highlight, label, statusIcon);

	let active = false;

	const hide = () => {
		highlight.style.display = "none";
		label.style.display = "none";
	};

	// attiva e disattiva inspector con Alt + X
	document.addEventListener("keydown", (event) => {

		if (!event.altKey || event.code !== "KeyX" || event.repeat) return;

		event.preventDefault();

		active = !active;

		statusIcon.style.display = active === true ? "block" : "none";

		if (active === false) hide();

		console.info(`📢 Eleventy Debug Inspector: ${active ? "ON" : "OFF"}`);
	});

	// identifica il blocco Nunjucks al passaggio del mouse
	document.addEventListener("pointermove", (event) => {

		if (!active) return;
		if (!(event.target instanceof Element)) return;

		let element = event.target;
		let region = null;

		while (element && !region) {

			region = regions.get(element);
			element = element.parentElement;
		}

		if (!region?.range) {

			hide();
			return;
		}

		const rect = region.range.getBoundingClientRect();

		if (rect.width === 0 || rect.height === 0) {
			hide();
			return;
		}

		highlight.style.display = "block";
		highlight.style.left = `${rect.left}px`;
		highlight.style.top = `${rect.top}px`;
		highlight.style.width = `${rect.width}px`;
		highlight.style.height = `${rect.height}px`;

		label.textContent = region.path;
		label.style.display = "block";

		const offset = 15;
		const {width, height} = label.getBoundingClientRect();

		let x = event.clientX + offset;
		let y = event.clientY + offset;

		// evita che l'etichetta esca dal viewport
		if (x + width > window.innerWidth) {

			x = event.clientX - width - offset;
		}

		if (y + height > window.innerHeight) {

			y = event.clientY - height - offset;
		}

		label.style.left = `${Math.max(8, x)}px`;
		label.style.top = `${Math.max(8, y)}px`;
	});

	document.addEventListener("scroll", hide, true);
	window.addEventListener("resize", hide);

})("__ELEVENTY_DEBUG_INSPECTOR_CONFIG__");
