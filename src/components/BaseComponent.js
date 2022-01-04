/**
 * BaseComponent
 *
 * Base component class used to extend to other classes.
 */
export class BaseComponent {

    /**
     * Construct the component
     *
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(config = {}) {
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

}