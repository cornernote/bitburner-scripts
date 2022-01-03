/**
 * simply lets you inject any old js code you want to the browser for the price of a tprint
 * https://www.reddit.com/r/Bitburner/comments/9llc0f/ram_cost_of_document_in_netscript_20/
 */

export function inject(ns, code) {
    let id = '' + Math.random() + Math.random();
    let output = `<div id="${id}" style="position:absolute; width: 100%; height:100%"`;
    output += ` onmouseover="${code} document.getElementById('${id}').remove();"></div>`
    ns.tprint(output);
}
