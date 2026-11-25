/**
* @preserve
* Filename: main.js
*
* Created: 24/11/2026
* Created by: Lorenzo Saibal Forti <lorenzo.forti@gmail.com>
*
* Copyleft: 2026 - Tutti i diritti riservati
*
* Comments:
*/

const fs = require("node:fs");
const path = require("node:path");
const pkg = require("./package.json");

/** conf di default per i box selezionati */
const defaultConfig = {
	"runOnlyDevMode": true,
	"shortcodeName": "debugInspector",
	"overlayBorderColor": "#f97316",
	"overlayBackgroundColor": "rgba(249, 115, 22, 0.08)",
	"labelBackgroundColor": "#222",
	"labelTextColor": "white",
	"labelFontSize": "14px"
};

// gestione parametro IIFE per inspector.js
const inspectorConfigPlaceholder = "__ELEVENTY_DEBUG_INSPECTOR_CONFIG__";

module.exports = (eleventyConfig, config = {}) => {

	// merge conf
	const pluginConfig = {
		...defaultConfig,
		...config
	};

	eleventyConfig.versionCheck(pkg["11ty"].compatibility);

	const isEnabled = pluginConfig["runOnlyDevMode"] === false || process.env.NODE_ENV !== "production";
	let inspectorScript = "";

	if (isEnabled === true) {

		// include script inspector (lo script che va in pagina)
		const inspectorScriptPath = path.join(__dirname, "dist", "inspector-script.min.js");
		// include del logo per successiva serializzazione
		const inspectorIconPath = path.join(__dirname, "img", "inspector.svg");

		// merge delle opzioni css da includere in pagina
		const getCssOption = (optionName) => {

			const optionValue = pluginConfig[optionName];

			if (typeof optionValue !== "string" || optionValue.trim() === "") {

				return defaultConfig[optionName];
			}

			return optionValue;
		};

		const inspectorConfig = {
			"overlayBorderColor": getCssOption("overlayBorderColor"),
			"overlayBackgroundColor": getCssOption("overlayBackgroundColor"),
			"labelBackgroundColor": getCssOption("labelBackgroundColor"),
			"labelTextColor": getCssOption("labelTextColor"),
			"labelFontSize": getCssOption("labelFontSize"),
			"iconSrc": "data:image/svg+xml;base64," + fs.readFileSync(inspectorIconPath).toString("base64")
		};

		const serializedInspectorConfig = JSON.stringify(inspectorConfig).replace(/</g, "\\u003c");

		// sostituisco il placeholder della IIFE di inspector.js con l'oggetto delle custom option
		inspectorScript = fs.readFileSync(inspectorScriptPath, "utf8");
		inspectorScript = inspectorScript.replace(JSON.stringify(inspectorConfigPlaceholder), () => {

			return serializedInspectorConfig;
		});
	}

	// gestione shortcode per inserire lo script in pagina
	eleventyConfig.addShortcode(pluginConfig["shortcodeName"], () => {

		if (isEnabled === false) return "";

		return [
			"<script>",
			inspectorScript,
			"</script>"
		].join("\n");
	});

	if (isEnabled === false) return;

	const addDebugComments = (content) => {

		let updatedContent = content;
		const macroImports = new Map();

		/**
		 * Wrap del contenuto del template con commenti HTML usati dal Debug Inspector.
		 *
		 * @param {string} templateContent Contenuto del template da delimitare.
		 * @param {string} templatePath Percorso del template riportato nei commenti.
		 * @returns {string} Contenuto originale racchiuso tra i marcatori di inizio e fine.
		 */
		const wrapComments = (templateContent, templatePath) => {

			return [
				`<!-- DEBUG INSPECTOR:START ${templatePath} -->`,
				templateContent,
				`<!-- DEBUG INSPECTOR:END ${templatePath} -->`
			].join("\n");
		};

		/**
		 * Registra i macro importati associandoli al template di origine.
		 *
		 * Ignora le dichiarazioni non valide e restituisce invariato il blocco Nunjucks.
		 *
		 * @param {string} match Blocco di importazione completo.
		 * @param {string} templatePath Percorso del template importato.
		 * @param {string} importList Elenco dei macro dichiarati nell'importazione.
		 * @returns {string} Blocco di importazione originale.
		 */
		updatedContent = updatedContent.replace(/{%-?\s*from\s+["']([^"']+)["']\s+import\s+([\s\S]*?)\s*-?%}/g, (match, templatePath, importList) => {

			const macroList = importList.replace(/\s+with(?:out)?\s+context\s*$/, "");

			macroList.split(",").forEach((macroImport) => {

				const macroMatch = macroImport.trim().match(/^([a-zA-Z_$][\w$]*)(?:\s+as\s+([a-zA-Z_$][\w$]*))?$/);

				if (macroMatch === null) return;

				const macroName = macroMatch[2] ?? macroMatch[1];

				macroImports.set(macroName, templatePath);
			});

			return match;
		});

		/**
		 * Wrap di ogni inclusione individuata con i commenti di debug relativi al template.
		 *
		 * @param {string} match Inclusione completa trovata nel contenuto.
		 * @param {string} templatePath Percorso del template estratto dall'inclusione.
		 * @returns {string} Inclusione avvolta dai commenti di debug.
		 */
		updatedContent = updatedContent.replace(/{%-?\s*include\s+["']([^"']+)["'][^%]*?-?%}/g, (match, templatePath) => {

			return wrapComments(match, templatePath);
		});

		/**
		 * Wrap delle chiamate alle macro importate con i commenti di debug.
		 * Mantiene invariata la corrispondenza se la macro non è associata a un template.
		 *
		 * @param {string} match Chiamata alla macro individuata.
		 * @param {string} macroName Nome della macro.
		 * @returns {string} Chiamata originale o contenuto avvolto dai commenti.
		 */
		updatedContent = updatedContent.replace(/{{-?\s*([a-zA-Z_$][\w$]*)\s*\([\s\S]*?\)\s*-?}}/g, (match, macroName) => {

			const templatePath = macroImports.get(macroName);

			if (typeof templatePath === "undefined") return match;

			return wrapComments(match, templatePath);
		});

		return updatedContent;
	};

	/**
	 * Registra nell'ambiente Nunjucks l'estensione che aggiunge i commenti di debug durante il preprocessing.
	 *
	 * https://www.11ty.dev/docs/languages/markdown/#optional-amend-the-library-instance
	 *
	 * @param {import("nunjucks").Environment} nunjucksEnvironment Ambiente Nunjucks modificato direttamente.
	 */
	eleventyConfig.amendLibrary("njk", (nunjucksEnvironment) => {

		nunjucksEnvironment.addExtension("eleventy-debug-inspector", {
			"preprocess": addDebugComments
		});
	});
};
