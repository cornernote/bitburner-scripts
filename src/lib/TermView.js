/**
 * Create a Grid View display of the provided objects
 *
 * @param  {Object[]} objects Array of data objects
 * @return {string}
 */
export function listView(objects) {
    if (!objects.length) {
        return '-> 0 rows'
    }

    // Build header array
    const headers = Object.keys(objects[0])

    // Build column arrays
    const columns = objects.map(o => Object.values(o).map(p => formatProperty(p)))

    // Calculate widths
    const widths = []
    for (const cell in headers) {
        widths[cell] = columns.map(o => o[cell])
            .concat([headers[cell]])
            .map(s => s.toString().length)
            .reduce((a, b) => a > b ? a : b)
    }

    // Calculate alignment
    const align = []
    for (const cell in headers) {
        align[cell] = typeof columns[0][cell] === 'number' ? 'right' : 'left'
    }

    // Write separator
    let output = '|'
    for (const cell in headers) {
        output += `${''.padEnd(widths[cell] + 2, '=')}|`
    }

    // Write headers
    output += '\n|'
    for (const cell in headers) {
        output += ` ${headers[cell].toString().padEnd(widths[cell], ' ')} |`
    }

    // Write separator
    output += '\n|'
    for (const cell in headers) {
        output += `${''.padEnd(widths[cell] + 2, '=')}|`
    }

    // Write rows
    for (const row in columns) {
        output += '\n|'
        for (const cell in columns[row]) {
            if (align[cell] === 'left') {
                output += ` ${columns[row][cell].toString().padEnd(widths[cell], ' ')} |`
            } else {
                output += ` ${columns[row][cell].toString().padStart(widths[cell], ' ')} |`
            }
        }
    }

    // Write separator
    output += '\n|'
    for (const cell in headers) {
        output += `${''.padEnd(widths[cell] + 2, '=')}|`
    }

    // Write row count
    output += '\n-> ' + columns.length.toString() + ' rows'

    output += '\n'
    return output
}


/**
 * Create a Detail View display of the provided object
 *
 * @param  {Object} object Data object
 */
export function detailView(object) {

    // Build header array
    const headers = Object.keys(object)

    // Build column arrays
    const columns = Object.values(object).map(p => formatProperty(p))

    // Calculate widths
    const widths = {
        headers: headers.map(s => s.toString().length).reduce((a, b) => a > b ? a : b),
        columns: columns.map(s => s.toString().length).reduce((a, b) => a > b ? a : b),
    }

    // Write separator
    let output = '|'
    output += `${''.padEnd(widths.headers + 2, '=')}|`
    output += `${''.padEnd(widths.columns + 2, '=')}|`

    // Write output
    output += '\n'
    for (const cell in headers) {
        output += '|'
        output += ` ${headers[cell].toString().padEnd(widths.headers, ' ')} |`
        output += ` ${columns[cell].toString().padEnd(widths.columns, ' ')} |`
        output += '\n'
    }

    // Write separator
    output += '|'
    output += `${''.padEnd(widths.headers + 2, '=')}|`
    output += `${''.padEnd(widths.columns + 2, '=')}|`
    output += '\n'

    return output
}

/**
 * Format anything to a string or a number, for gridView()/detailView()
 *
 * @param {*} property
 * @return {string|number}
 */
function formatProperty(property) {
    if (typeof property === 'string' || typeof property === 'number') {
        return property
    }
    if (typeof property === 'boolean') {
        return property ? 'Y' : 'N'
    }
    if (property) {
        return JSON.stringify(property)
    }
    return ''
}
