sap.ui.define([
		"ZACBACSMGREP/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("ZACBACSMGREP.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);