/**
 * BaseComponent
 *
 * The base component class used to extend to other classes.
 */
export class BaseComponent {

    /**
     * Allows global access to the main application and it's components.
     * @type {Application}
     */
    app = null

    /**
     * Construct the component
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