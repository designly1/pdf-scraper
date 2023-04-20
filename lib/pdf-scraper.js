var PDFJS = null;

/**
 * Render PDF pages to text format.
 * @param {Object} pageData - The page data object.
 * @param {boolean} [render_options.normalizeWhitespace=false] - Replaces all occurrences of whitespace with standard spaces (0x20).
 * @param {boolean} [render_options.disableCombineTextItems=false] - Do not attempt to combine same line TextItem's.
 * @returns {Promise<string>} - The text content of the page.
 */
function render_page(pageData) {
	//check documents https://mozilla.github.io/pdf.js/
	//ret.text = ret.text ? ret.text : "";

	let render_options = {
		//replaces all occurrences of whitespace with standard spaces (0x20). The default value is `false`.
		normalizeWhitespace: false,
		//do not attempt to combine same line TextItem's. The default value is `false`.
		disableCombineTextItems: false
	}

	return pageData.getTextContent(render_options)
		.then(function (textContent) {
			let lastY, text = '';
			//https://github.com/mozilla/pdf.js/issues/8963
			//https://github.com/mozilla/pdf.js/issues/2140
			//https://gist.github.com/hubgit/600ec0c224481e910d2a0f883a7b98e3
			//https://gist.github.com/hubgit/600ec0c224481e910d2a0f883a7b98e3
			for (let item of textContent.items) {
				if (lastY == item.transform[5] || !lastY) {
					text += item.str;
				}
				else {
					text += '\n' + item.str;
				}
				lastY = item.transform[5];
			}
			//let strings = textContent.items.map(item => item.str);
			//let text = strings.join("\n");
			//text = text.replace(/[ ]+/ig," ");
			//ret.text = `${ret.text} ${text} \n\n`;
			return text;
		});
}

const DEFAULT_OPTIONS = {
	pagerender: render_page,
	max: 0,
	//check https://mozilla.github.io/pdf.js/getting_started/
	version: 'v1.10.100'
}

/**
 * Parse a PDF file to text format.
 * @param {Buffer} dataBuffer - The PDF file buffer.
 * @param {Object} [options] - The parsing options.
 * @param {Function} [options.pagerender=render_page] - The function to render each page.
 * @param {number} [options.max=0] - The maximum number of pages to render. Set to 0 to render all pages.
 * @param {string} [options.version='v1.10.100'] - The version of PDF.js to use. Set to 'default' to use the default version.
 * @returns {Promise<Object>} - The parsed PDF data object.
 * @property {number} numpages - The number of pages in the PDF.
 * @property {Array<string>} pages - The text content of each page.
 * @property {number} numrender - The number of pages rendered.
 * @property {Object|null} info - The PDF information dictionary.
 * @property {Object|null} metadata - The PDF metadata.
 * @property {string} text - The combined text content of all pages.
 * @property {string} version - The version of PDF.js used.
 */
async function PDF(dataBuffer, options) {
	var isDebugMode = false;

	let ret = {
		numpages: 0,
		pages: [],
		numrender: 0,
		info: null,
		metadata: null,
		text: "",
		version: null
	};

	if (typeof options == 'undefined') options = DEFAULT_OPTIONS;
	if (typeof options.pagerender != 'function') options.pagerender = DEFAULT_OPTIONS.pagerender;
	if (typeof options.max != 'number') options.max = DEFAULT_OPTIONS.max;
	if (typeof options.version != 'string') options.version = DEFAULT_OPTIONS.version;
	if (options.version == 'default') options.version = DEFAULT_OPTIONS.version;

	PDFJS = PDFJS ? PDFJS : require(`./pdf.js/${options.version}/build/pdf.js`);

	ret.version = PDFJS.version;

	// Disable workers to avoid yet another cross-origin issue (workers need
	// the URL of the script to be loaded, and dynamically loading a cross-origin
	// script does not work).
	PDFJS.disableWorker = true;
	let doc = await PDFJS.getDocument(dataBuffer);
	ret.numpages = doc.numPages;

	let metaData = await doc.getMetadata().catch(function (err) {
		return null;
	});

	ret.info = metaData ? metaData.info : null;
	ret.metadata = metaData ? metaData.metadata : null;

	let counter = options.max <= 0 ? doc.numPages : options.max;
	counter = counter > doc.numPages ? doc.numPages : counter;

	ret.text = "";

	for (var i = 1; i <= counter; i++) {
		let pageText = await doc.getPage(i).then(pageData => options.pagerender(pageData)).catch((err) => {
			// todo log err using debug
			debugger;
			return "";
		});

		ret.pages.push(pageText);
		ret.text = `${ret.text}\n\n${pageText}`;
	}

	ret.numrender = counter;
	doc.destroy();

	return ret;
}

module.exports = PDF;
