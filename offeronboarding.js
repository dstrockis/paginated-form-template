// Global variables
var navStack = [];
var scopes = [];
var idToPanelMap = {}
var isMsaUsersEnabled;
var isAADUsersEnabled;
var scopeStringIndex = 0;
var isAppOnlyPerm;
var isAdminOnlyPerm;
var isUsedInMsGraph;
var siteId = 0;

// Global controls
var $backButton = $("#back-button");
$backButton.click(function () {
    navStack[navStack.length-1].pop();
});

// Utilities
function jq( myid ) {
    if (myid === undefined)
        return undefined;
    return "#" + myid.replace( /(:|\.|\[|\]|,)/g, "\\$1" );
}

// Classes
var Panel = function (id, nextPanelDefaultId) {
    idToPanelMap[id] = this;
    this.id = id;
    this.$jq = $(id);
    this.nextPanelDefaultId = nextPanelDefaultId;
    this.$buttons = this.$jq.find("button");
    var that = this;
    this.$buttons.click(function () {
        that.advance('#' + $(this).attr("id"));
    });
};

Panel.prototype.push = function () {
    // pre-process and bring into view
    var that = this;
    navStack[navStack.length-1].$jq.hide("slide", {direction: "up"}, 200, function () {
        that.$jq.show("slide", {direction: "down" }, 200);
    });
    navStack.push(this);
    if (navStack.length > 1) { $backButton.show(); }
};

Panel.prototype.pop = function () {
    // post-process and go back one panel
    navStack.pop().$jq.hide("slide", {direction: "down"}, 200, function () {
        navStack[navStack.length-1].$jq.show("slide", {direction: "up" }, 200);
    });
    if (navStack.length <= 1) { $backButton.hide();}
};

Panel.prototype.advance = function (selectionId) {
    // determine next panel based on id selection
    // by default, go to the default next panel
    nextPanel = idToPanelMap[this.nextPanelDefaultId];
    nextPanel.push();
}

// Panels
var welcome = new Panel("#welcome", "#docs");
var docs = new Panel("#docs", "#define");

var define = new Panel("#define", "#msa-users-enabled");
define.advance = function (selectionId) {

    // establish the list of scopes from the user
    scopes = [];
    $("input#scopes").val().split(' ').forEach(function(val) {
        if (val != undefined && val != "") { scopes.push({ value: val }); }
    });

    Panel.prototype.advance.call(this, selectionId);
}

var msaUsersEnabled = new Panel("#msa-users-enabled");
msaUsersEnabled.advance = function(selectionId) {
    switch(selectionId) {
        case "#btn-msa-users-enabled":
            isMsaUsersEnabled = true;
            msmRegister.push();
            break;
        case "#btn-msa-users-disabled":
            isMsaUsersEnabled = false;
            aadUsersEnabled.push();
            break;
        default:
    }
};

var aadUsersEnabled = new Panel("#aad-users-enabled");
aadUsersEnabled.advance = function(selectionId) {
    switch(selectionId) {
        case "#btn-aad-users-enabled":
            isAADUsersEnabled = true;
            aadRegister.push();
            break;
        case "#btn-aad-users-disabled":
            isAADUsersEnabled = false;
            if (!isMsaUsersEnabled) { errorNoUsers.push(); }
            else { enterStringsTemplate.push(); }
            break;
        default:
    }
}

var enterStringsTemplate = new Panel("#enter-strings");
enterStringsTemplate.push = function () {
    scopeStringIndex = 0;

    // clean up existing string entry html elements
    $("div.enter-strings-instance").remove();

    var that = this;
    scopes.forEach(function (val, i, scps) {

        // attach necessary html to the dom
        $newEnterStrings = that.$jq.clone();
        $newEnterStrings.find("mark#scope").text(val.value);
        $newEnterStrings.find("button#btn-enter-string").data("scp", val.value);
        $newEnterStrings.attr("id", val.value);
        $newEnterStrings.addClass("enter-strings-instance");
        that.$jq.after($newEnterStrings);

        // create panels for each scope
        nextScope = undefined;
        if (scps[i+1] !== undefined) { nextScope = scps[i+1].value; }
        temp = new Panel(jq(val.value), jq(nextScope));
        temp.push = function () {
            // increment the count of scopes collected
            scopeStringIndex++;

            // hide/show string fields based on previous selections
            $resourceDisplayName = this.$jq.find("div#resource-display-name");
            $appOnlyDisplayName = this.$jq.find("div#app-only-display-name");
            $appOnlyDescription = this.$jq.find("div#app-only-description");
            $adminDisplayName = this.$jq.find("div#admin-display-name");
            $adminDescription = this.$jq.find("div#admin-description");
            $userDisplayName = this.$jq.find("div#user-display-name");
            $userDescription = this.$jq.find("div#user-description");

            $resourceDisplayName.show();
            if (isAppOnlyPerm) {
                $appOnlyDisplayName.show();
                $appOnlyDescription.show();
                $adminDisplayName.hide();
                $adminDescription.hide();
                $userDisplayName.hide();
                $userDescription.hide();
            } else if (isAdminOnlyPerm && !isMsaUsersEnabled) {
                $appOnlyDisplayName.hide();
                $appOnlyDescription.hide();
                $adminDisplayName.show();
                $adminDescription.show();
                $userDisplayName.hide();
                $userDescription.hide();
            } else if (isMsaUsersEnabled && !isAADUsersEnabled) {
                $appOnlyDisplayName.hide();
                $appOnlyDescription.hide();
                $adminDisplayName.hide();
                $adminDescription.hide();
                $userDisplayName.show();
                $userDescription.show();
            } else {
                $appOnlyDisplayName.hide();
                $appOnlyDescription.hide();
                $adminDisplayName.show();
                $adminDescription.show();
                $userDisplayName.show();
                $userDescription.show();
            }

            // show the panel
            Panel.prototype.push.call(this);
        };
        temp.advance = function (selectionId) {

            // record the strings on the scope
            scopes[i]['strings'] = {
                resourceDisplayName: this.$jq.find("input#resource-display-name").val(),
                appOnlyDisplayName: this.$jq.find("input#app-only-display-name").val(),
                appOnlyDescription: this.$jq.find("input#app-only-description").val(),
                adminDisplayName: this.$jq.find("input#admin-display-name").val(),
                adminDescription: this.$jq.find("input#admin-description").val(),
                userDisplayName: this.$jq.find("input#user-display-name").val(),
                userDescription: this.$jq.find("input#user-description").val(),
            }

            // if more strings to collect, go to the next one
            if (scopeStringIndex < scopes.length) {
                Panel.prototype.advance.call(this, selectionId);
                return;
            }

            // if done with all strings, advance to next step
            if (isAADUsersEnabled) { msGraph.push(); }
            else { tfsStrings.push(); }
        };
        temp.pop = function () {
            delete idToPanelMap[this.id];
            Panel.prototype.pop.call(this);
        };
        
    });

    // prepare string entry tooltips
    $('[data-toggle="tooltip"]').tooltip();

    // push the first panel
    idToPanelMap[jq(scopes[0].value)].push();
    
};

var msmRegister = new Panel("#register-msm", "#aad-users-enabled");
msmRegister.advance = function (selectionId) {
    siteId = this.$jq.find("#site-id").text();
    Panel.prototype.advance.call(this, selectionId);
}

var aadRegister = new Panel("#aad-register");
aadRegister.advance = function(selectionId) {
    if (!isMsaUsersEnabled) { permissionType.push(); }
    else { adminOnly.push(); } 
};

var permissionType = new Panel("#permission-type");
permissionType.advance = function (selectionId) {
    switch(selectionId) {
        case "#btn-app-only":
            isAppOnlyPerm = true;
            enterStringsTemplate.push();
            break;
        case "#btn-delegated":
            isAppOnlyPerm = false;
            adminOnly.push();
            break;
        default:
    }
};

var adminOnly = new Panel("#admin-only");
adminOnly.advance = function (selectionId) {
    switch(selectionId) {
        case "#btn-admin-only-true":
            isAdminOnlyPerm = true;
            enterStringsTemplate.push();
            break;
        case "#btn-admin-only-false":
            isAdminOnlyPerm = false;
            enterStringsTemplate.push();
            break;
        default:
    }
};

var msGraph = new Panel("#ms-graph");
msGraph.advance = function (selectionId) {
    switch(selectionId) {
        case "#btn-ms-graph-true":
            isUsedInMsGraph = true;
            spreadsheetTable.push();
            break;
        case "#btn-ms-graph-false":
            isUsedInMsGraph = false;
            if (isMsaUsersEnabled) { errorConvergedAuth.push(); }
            else { aadOnboarding.push(); }
            break;
        default:
    }
};

var spreadsheetTable = new Panel("#spreadsheet-table", "#graph-review");
spreadsheetTable.push = function () {

    // populate strings in the table
    var $stringTableRow = this.$jq.find("tr#string-table-row");
    scopes.forEach(function (val) {
        $newRow = $stringTableRow.clone();
        $newRow.children()[0].innerHTML = val.value;
        $newRow.children()[1].innerHTML = val.strings.resourceDisplayName;
        $newRow.children()[2].innerHTML = val.strings.appOnlyDisplayName;
        $newRow.children()[3].innerHTML = val.strings.appOnlyDescription;
        $newRow.children()[4].innerHTML = val.strings.adminDisplayName;
        $newRow.children()[5].innerHTML = val.strings.adminDescription;
        $newRow.children()[6].innerHTML = val.strings.userDisplayName;
        $newRow.children()[7].innerHTML = val.strings.userDescription;
        $stringTableRow.after($newRow);
        $newRow.addClass("string-row");
        $newRow.show();
    });

    // show the panel
    Panel.prototype.push.call(this);

};
spreadsheetTable.pop = function () {
    
    // Clean up old rows in the table
    var $stringTableBody = this.$jq.find("tbody");
    $stringTableBody.find("tr.string-row").remove();

    // hide the panel
    Panel.prototype.pop.call(this);
};

var aadOnboarding = new Panel("#aad-onboarding", "#monitor-approvals");
aadOnboarding.push = function () {

    // populate the table of strings
    var $tableRow = this.$jq.find("#aad-onboarding-table-row");
    scopes.forEach(function (val) {
        $newRow = $tableRow.clone();
        if (isAppOnlyPerm) {
            $newRow.children()[0].innerHTML = "Application Permission";
            $newRow.children()[1].innerHTML = "Admin";
            $newRow.children()[2].innerHTML = "Application";
            $newRow.children()[3].innerHTML = val.strings.appOnlyDisplayName;
            $newRow.children()[4].innerHTML = val.strings.appOnlyDescription;
            $newRow.children()[5].innerHTML = "n/a";
            $newRow.children()[6].innerHTML = "n/a";
            $newRow.children()[7].innerHTML = val.value;
        } else {
            $newRow.children()[0].innerHTML = "Delegation Permission";
            $newRow.children()[2].innerHTML = "n/a";
            $newRow.children()[3].innerHTML = val.strings.adminDisplayName;
            $newRow.children()[4].innerHTML = val.strings.adminDescription;
            $newRow.children()[7].innerHTML = val.value;
            if (isAdminOnlyPerm) {
                $newRow.children()[1].innerHTML = "Admin";
                $newRow.children()[5].innerHTML = "n/a";
                $newRow.children()[6].innerHTML = "n/a";
            }
            else {
                $newRow.children()[1].innerHTML = "User";
                $newRow.children()[5].innerHTML = val.strings.userDisplayName;
                $newRow.children()[6].innerHTML = val.strings.userDescription;
            }
        }
        $tableRow.after($newRow);
        $newRow.addClass("aad-onboarding-table-row");
        $newRow.show();
    });

    // show the panel
    Panel.prototype.push.call(this);

};
aadOnboarding.pop = function () {

    // clean up old rows in the table
    var $stringTableBody = this.$jq.find("tbody");
    $stringTableBody.find("tr.aad-onboarding-table-row").remove();

    // hide the panel
    Panel.prototype.pop.call(this);

};

var graphReview = new Panel("#graph-review", "#ms-graph-aad-onboarding");
var msGraphOnboarding = new Panel("#ms-graph-aad-onboarding");
msGraphOnboarding.push = function () {

    // populate the table of strings
    var $tableRow = this.$jq.find("#msgraph-onboarding-table-row");
    scopes.forEach(function (val) {
        $newRow = $tableRow.clone();
        if (isAppOnlyPerm) {
            $newRow.children()[0].innerHTML = "Application Permission";
            $newRow.children()[1].innerHTML = "Admin";
            $newRow.children()[2].innerHTML = "Application";
            $newRow.children()[3].innerHTML = val.strings.appOnlyDisplayName;
            $newRow.children()[4].innerHTML = val.srings.appOnlyDescription;
            $newRow.children()[5].innerHTML = "n/a";
            $newRow.children()[6].innerHTML = "n/a";
            $newRow.children()[7].innerHTML = val.value;
        } else {
            $newRow.children()[0].innerHTML = "Delegation Permission";
            $newRow.children()[2].innerHTML = "n/a";
            $newRow.children()[3].innerHTML = val.strings.adminDisplayName;
            $newRow.children()[4].innerHTML = val.strings.adminDescription;
            $newRow.children()[7].innerHTML = val.value;
            if (isAdminOnlyPerm) {
                $newRow.children()[1].innerHTML = "Admin";
                $newRow.children()[5].innerHTML = "n/a";
                $newRow.children()[6].innerHTML = "n/a";
            }
            else {
                $newRow.children()[1].innerHTML = "User";
                $newRow.children()[5].innerHTML = val.strings.userDisplayName;
                $newRow.children()[6].innerHTML = val.strings.userDescription;
            }
        }
        $tableRow.after($newRow);
        $newRow.addClass("msgraph-onboarding-table-row");
        $newRow.show();
    });


    // show the panel
    Panel.prototype.push.call(this);
};
msGraphOnboarding.pop = function () {

    // Clean up table
    var $stringTableBody = this.$jq.find("tbody");
    $stringTableBody.find("tr.msgraph-onboarding-table-row").remove();

    // hide the panel
    Panel.prototype.pop.call(this);
};
msGraphOnboarding.advance = function (selectionId) {
    if (!isMsaUsersEnabled && isAppOnlyPerm) { monitorApprovals.push(); } 
    else if (!isMsaUsersEnabled) { estsWhitelist.push(); } 
    else if ($msaUsersEnabled) { tfsStrings.push(); }
};

var ccmPermsList = new Panel("#ccm-perms-list");
ccmPermsList.push = function () {
    scopesList = "";
    scopes.forEach(function (val) {
        scopesList += val.value + ', ';
    });
    this.$jq.find("#scopes-list").text(scopesList);
    Panel.prototype.push.call(this);
};
ccmPermsList.advance = function (selectionId) {
    if (!isMsaUsersEnabled && isUsedInMsGraph) { xmlOrgOnly.push(); } 
    else if (isMsaUsersEnabled && !$aadUsersEnabled) { xmlMsa.push(); } 
    else if (isMsaUsersEnabled && $aadUsersEnabled) { xmlMsGraph.push(); }
};

var tfsStrings = new Panel("#tfs-strings");
tfsStrings.push = function () {

    var offerTfsTemplate = "http://daipvstf:8080/tfs/ActiveDirectory/MSA/_workItems/create/Task?%5BSystem.Title%5D=%5BOffer+provision%2Fupdate%5D+{item-title}&%5BSystem.AssignedTo%5D=Navindra+Umanee+%3CREDMOND%5Cnumanee%3E&%5BSystem.Description%5D={description-html}&%5BMicrosoft.VSTS.CMMI.TaskType%5D=Ops+Task&%5BSystem.AreaPath%5D=MSA%5CLogin+Experience";

    var runningHtml = "";

    var scopeTfsTemplate = this.$jq.find("#tfs-scope-html").html();
    scopes.forEach(function (scope) {
        newSection = scopeTfsTemplate.slice(0);
        newSection = newSection.replace("{action-name}", scope.value);
        newSection = newSection.replace("{action-title}", scope.strings.userDisplayName);
        newSection = newSection.replace("{action-summary}", scope.strings.userDisplayName);
        var userDescription = scope.strings.userDescription.toLowerCase().replace("allows the app to", "{0} will be able to");
        newSection = newSection.replace("{action-description}", userDescription);
        runningHtml += newSection;
    });

    var url = offerTfsTemplate.replace("{item-title}", scopes[0].value.split('.')[0]);
    url = url.replace("{description-html}", encodeURIComponent(runningHtml));
    this.$jq.find("#tfs-link").attr("href", url);

    Panel.prototype.push.call(this);
};
tfsStrings.advance = function (selectionId) {
    if (isAADUsersEnabled) { estsWhitelist.push(); }
    else { xmlMsa.push(); }
}

var estsWhitelist = new Panel("#ests-whitelist", "#ccm-perms-list");
estsWhitelist.push = function () {
    var scopesList = "";
    scopes.forEach(function (val) {
        scopesList += val.value + ', ';
    });
    this.$jq.find("#scopes-list").text(scopesList);
    Panel.prototype.push.call(this);
};

var xmlOrgOnly = new Panel("#xml-org-only", "#monitor-approvals");
xmlOrgOnly.push = function () {

    var offerName = scopes[0].value.split('.')[0];
    var offerDescription = scopes[0].strings.resourceDisplayName;

    this.$jq.find(".offer-name").text(offerName);
    this.$jq.find(".offer-service").text(offerDescription);
    var actionContainer = this.$jq.find("#action-container");

    var template = this.$jq.find("#action-template");
    scopes.forEach(function (scope) {
        
        newOfferAction = template.clone();
        actionSegments = scope.value.split('.');

        if (Array.isArray(actionSegments)) {
            actionSegments.shift();
            actionName = actionSegments.join('.');
            newOfferAction.find(".action-name").text(actionName);
        }

        newOfferAction.find(".user-consent-display-name").text(scope.strings.userDisplayName);
        newOfferAction.find(".user-consent-description").text(scope.strings.userDescription);

        actionContainer.append(newOfferAction);
        newOfferAction.show();
    });

    Panel.prototype.push.call(this);    
};
xmlOrgOnly.pop = function () {
    
    // Clean up old rows in the table
    this.$jq.find("#action-container").empty();

    // hide the panel
    Panel.prototype.pop.call(this);
}

var errorNoUsers = new Panel("#error-no-users");
var errorConvergedAuth = new Panel("#error-must-use-ms-graph");
var xmlMsGraph = new Panel("#xml-ms-graph", "#monitor-approvals");
var xmlMsa = new Panel("#xml-msa", "#monitor-approvals");
var monitorApprovals = new Panel("#monitor-approvals", "#monitor-deployments");
var monitorDeployments = new Panel("#monitor-deployments", "#test");
var test = new Panel("#test");

// Start first panel
navStack.push(welcome);