/**
 * BaseComponent
 *
 * Base component class used to extend to other classes.
 */
export class BaseComponent {

    /**
     * @type {Application}
     */
    app = null

    /**
     * Construct the component
     *
     * @param {Application} app - the application instance created in the entry script
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(app, config = {}) {
        // set the application
        this.app = app;
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

}