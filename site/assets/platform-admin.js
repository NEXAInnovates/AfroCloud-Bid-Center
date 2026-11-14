(function () {
  "use strict";

  var API = "api/index.php";
  var data = { organizations: [], members: [], subscriptions: [], support_requests: [], admin_events: [] };
  var tokenKey = "afc_access_token";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function request(route, options) {
    options = options || {};
    var headers = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    var token = sessionStorage.getItem(tokenKey);
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(API + "?route=" + encodeURIComponent(route) + (options.id ? "&id=" + encodeURIComponent(options.id) : ""), {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }).then(function (response) {
      return response.json().catch(function () { throw new Error("The server returned an unreadable response."); }).then(function (result) {
        if (!response.ok || result.ok === false) {
          var error = new Error(result.error || "The request could not be completed.");
          error.status = response.status;
          throw error;
        }
        return result;
      });
    });
  }

  function notify(message, failed) {
    var el = document.getElementById("adminNotice");
    el.textContent = message;
    el.className = "notice show" + (failed ? " error" : "");
    window.setTimeout(function () { el.className = "notice"; }, 3500);
  }

  function dateLabel(value) {
    if (!value) return "—";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  }

  function render() {
    var membersByOrg = {};
    var orgById = {};
    var subscriptionsByOrg = {};
    data.organizations.forEach(function (organization) { orgById[organization.id] = organization; });
    data.members.forEach(function (member) {
      (membersByOrg[member.organization_id] || (membersByOrg[member.organization_id] = [])).push(member);
    });
    data.subscriptions.forEach(function (subscription) { subscriptionsByOrg[subscription.organization_id] = subscription; });
    var trials = data.subscriptions.filter(function (subscription) { return subscription.status === "trialing"; }).length;
    var paid = data.subscriptions.filter(function (subscription) { return subscription.status === "active"; }).length;
    var inactive = data.organizations.filter(function (organization) { return !organization.active; }).length;
    var returning = data.subscriptions.filter(function (subscription) { return subscription.returning_client; }).length;
    document.getElementById("adminStats").innerHTML =
      statCard("REGISTERED WORKSPACES", data.organizations.length) +
      statCard("ON FREE TRIAL", trials) +
      statCard("PAID ACTIVE", paid) +
      statCard("INACTIVE / RETURNING", inactive + " / " + returning);
    document.getElementById("customerRows").innerHTML = data.organizations.map(function (organization) {
      var members = membersByOrg[organization.id] || [];
      var owner = members.find(function (member) { return member.role === "owner"; }) || members[0] || {};
      var subscription = subscriptionsByOrg[organization.id] || { plan: "pro", status: "expired" };
      return '<tr data-customer="' + escapeHtml(organization.id) + '"><td><input class="field admin-name" maxlength="190" value="' +
        escapeHtml(organization.name) + '"><small>' + escapeHtml(organization.id) + '</small></td><td>' +
        escapeHtml(owner.display_name || "Owner not found") + '<br><a href="mailto:' + escapeHtml(owner.email || "") + '">' + escapeHtml(owner.email || "No email") + '</a><br>' +
        escapeHtml(owner.phone || "No phone") + '</td><td><select class="select admin-plan">' + option("pro", "Pro · $10") +
        option("premium", "Premium · $50") + option("enterprise", "Enterprise · $100") + '</select><select class="select admin-sub-status">' +
        option("trialing", "Trial") + option("active", "Active") + option("past_due", "Past due") + option("expired", "Expired") +
        option("canceled", "Canceled") + '</select><small>' + escapeHtml(subscription.provider || "No payment provider") + '</small></td><td>' +
        escapeHtml(dateLabel(subscription.trial_started_at)) + " → " + escapeHtml(dateLabel(subscription.trial_ends_at)) +
        '</td><td><select class="select admin-org-status">' + option("true", "Workspace active") + option("false", "Workspace inactive") +
        '</select><small>' + escapeHtml(subscription.returning_client ? "Returning customer" : "First subscription") + '</small></td><td><div class="platform-actions">' +
        '<button class="button button-small" data-save-customer>Save changes</button><button class="button button-small" data-action-deactivate="' +
        escapeHtml(String(organization.active)) + '">' + (organization.active ? "Deactivate" : "Reactivate") + '</button></div></td></tr>';
    }).join("") || '<tr><td colspan="6">No customer workspaces yet.</td></tr>';

    data.organizations.forEach(function (organization) {
      var row = document.querySelector('[data-customer="' + organization.id + '"]');
      if (!row) return;
      var subscription = subscriptionsByOrg[organization.id] || {};
      row.querySelector(".admin-plan").value = subscription.plan || "pro";
      row.querySelector(".admin-sub-status").value = subscription.status || "expired";
      row.querySelector(".admin-org-status").value = String(Boolean(organization.active));
    });

    document.getElementById("memberRows").innerHTML = data.members.map(function (member) {
      var organization = orgById[member.organization_id] || {};
      return '<tr data-member="' + escapeHtml(member.user_id) + '"><td><input class="field member-name" maxlength="120" value="' +
        escapeHtml(member.display_name) + '"></td><td><a href="mailto:' + escapeHtml(member.email) + '">' + escapeHtml(member.email) + '</a></td><td><input class="field member-phone" maxlength="32" value="' +
        escapeHtml(member.phone || "") + '"></td><td>' + escapeHtml(organization.name || "Workspace removed") + '</td><td>' +
        escapeHtml(member.role) + '</td><td>' + escapeHtml(dateLabel(member.last_sign_in_at)) + '</td><td>' +
        (member.marketing_consent ? "Yes · " + escapeHtml(dateLabel(member.marketing_consent_at)) : "No") +
        '</td><td>' + (member.active ? "Active" : "Inactive") + '</td><td><div class="platform-actions"><button class="button button-small" data-save-member>Save</button>' +
        '<button class="button button-small" data-member-active="' + String(!member.active) + '">' + (member.active ? "Deactivate" : "Reactivate") + "</button></div></td></tr>";
    }).join("") || '<tr><td colspan="9">No registered users yet.</td></tr>';

    document.getElementById("leadRows").innerHTML = data.support_requests.map(function (lead) {
      return '<tr><td>' + escapeHtml(dateLabel(lead.created_at)) + '</td><td>' + escapeHtml(lead.name) + '<br><a href="mailto:' +
        escapeHtml(lead.email) + '">' + escapeHtml(lead.email) + '</a><br>' + escapeHtml(lead.phone || "No phone") + '</td><td>' +
        escapeHtml(lead.subject) + '</td><td title="' + escapeHtml(lead.message) + '">' + escapeHtml(lead.message.slice(0, 240)) +
        (lead.message.length > 240 ? "…" : "") + '</td><td>' + (lead.marketing_consent ? "Yes · " + escapeHtml(dateLabel(lead.marketing_consent_at)) : "No") +
        '</td><td><select class="select lead-status" data-support-id="' + escapeHtml(lead.id) + '">' +
        option("new", "New") + option("in_progress", "In progress") + option("resolved", "Resolved") + '</select></td></tr>';
    }).join("") || '<tr><td colspan="6">No support requests or contact leads yet.</td></tr>';
    data.support_requests.forEach(function (lead) {
      var select = document.querySelector('[data-support-id="' + lead.id + '"]');
      if (select) select.value = lead.status;
    });
    document.getElementById("adminEventRows").innerHTML = data.admin_events.map(function (event) {
      return '<tr><td>' + escapeHtml(dateLabel(event.created_at)) + '</td><td>' + escapeHtml(event.event_type) +
        '</td><td>' + escapeHtml(orgById[event.target_organization_id]?.name || event.target_organization_id || "—") +
        '</td><td>' + escapeHtml(JSON.stringify(event.detail_json || {})) + '</td></tr>';
    }).join("") || '<tr><td colspan="4">No administration changes yet.</td></tr>';
  }

  function option(value, label) {
    return '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + "</option>";
  }

  function statCard(label, value) {
    return '<article class="stat-card"><div class="stat-top">' + escapeHtml(label) +
      '</div><div class="stat-value">' + escapeHtml(value) + '</div></article>';
  }

  function loadConsole() {
    return request("platform-admin").then(function (result) {
      data = result;
      document.getElementById("adminLogin").hidden = true;
      document.getElementById("adminConsole").hidden = false;
      render();
    });
  }

  function saveCustomer(row) {
    var id = row.dataset.customer;
    var organization = request("platform-org", {
      method: "PATCH", id: id,
      body: { name: row.querySelector(".admin-name").value, active: row.querySelector(".admin-org-status").value === "true" },
    });
    var billing = request("platform-billing", {
      method: "PATCH", id: id,
      body: { plan: row.querySelector(".admin-plan").value, status: row.querySelector(".admin-sub-status").value },
    });
    return Promise.all([organization, billing]).then(loadConsole);
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportOptedIn() {
    var consentedMembers = data.members.filter(function (member) { return member.marketing_consent === true; })
      .map(function (member) { return [member.display_name, member.email, member.phone, member.marketing_consent_at, "Registered account"]; });
    var consentedLeads = data.support_requests.filter(function (lead) { return lead.marketing_consent === true; })
      .map(function (lead) { return [lead.name, lead.email, lead.phone, lead.marketing_consent_at, "Contact request"]; });
    var rows = [["Name", "Email", "Phone", "Consent timestamp", "Source"]].concat(consentedMembers, consentedLeads);
    var blob = new Blob(["\ufeff", rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n")], { type: "text/csv;charset=utf-8" });
    var anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "nexa-opted-in-contacts-" + new Date().toISOString().slice(0, 10) + ".csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  document.getElementById("adminLoginForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var error = document.getElementById("adminLoginError");
    error.textContent = "";
    var form = event.target;
    request("login", { method: "POST", body: { username: document.getElementById("adminEmail").value, password: document.getElementById("adminPassword").value } })
      .then(function (session) {
        sessionStorage.setItem(tokenKey, session.access_token);
        sessionStorage.setItem("afc_refresh_token", session.refresh_token);
        return loadConsole();
      }).catch(function (failure) {
        error.textContent = failure.message;
        if (failure.status === 403) document.getElementById("adminSetupForm").hidden = false;
      });
  });

  document.getElementById("adminSetupForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var error = document.getElementById("adminSetupError");
    error.textContent = "";
    request("platform-admin-setup", { method: "POST", body: { setup_key: document.getElementById("setupKey").value } })
      .then(function (result) { notify(result.message); return loadConsole(); })
      .catch(function (failure) { error.textContent = failure.message; });
  });

  document.getElementById("adminConsole").addEventListener("click", function (event) {
    var customerSave = event.target.closest("[data-save-customer]");
    if (customerSave) {
      var customerRow = customerSave.closest("[data-customer]");
      customerSave.disabled = true;
      saveCustomer(customerRow).then(function () { notify("Workspace and billing settings saved."); })
        .catch(function (error) { notify(error.message, true); }).finally(function () { customerSave.disabled = false; });
      return;
    }
    var memberSave = event.target.closest("[data-save-member]");
    if (memberSave) {
      var memberRow = memberSave.closest("[data-member]");
      var memberId = memberRow.dataset.member;
      memberSave.disabled = true;
      request("platform-user", { method: "PATCH", id: memberId, body: {
        display_name: memberRow.querySelector(".member-name").value,
        phone: memberRow.querySelector(".member-phone").value,
      } }).then(loadConsole).then(function () { notify("Customer contact updated."); })
        .catch(function (error) { notify(error.message, true); }).finally(function () { memberSave.disabled = false; });
      return;
    }
    var memberActive = event.target.closest("[data-member-active]");
    if (memberActive) {
      request("platform-user", { method: "PATCH", id: memberActive.closest("[data-member]").dataset.member, body: {
        active: memberActive.dataset.memberActive === "true",
      } }).then(loadConsole).then(function () { notify("Customer account status updated."); })
        .catch(function (error) { notify(error.message, true); });
    }
  });

  document.getElementById("adminConsole").addEventListener("change", function (event) {
    var target = event.target;
    if (!target.matches("[data-support-id]")) return;
    request("platform-support", { method: "PATCH", id: target.dataset.supportId, body: { status: target.value } })
      .then(loadConsole).then(function () { notify("Support request status updated."); })
      .catch(function (error) { notify(error.message, true); });
  });

  document.getElementById("refreshAdmin").addEventListener("click", function () {
    loadConsole().catch(function (error) { notify(error.message, true); });
  });
  document.getElementById("exportLeads").addEventListener("click", exportOptedIn);
  document.getElementById("adminLogout").addEventListener("click", function () {
    request("logout", { method: "POST", body: {} }).catch(function () { return null; }).then(function () {
      sessionStorage.removeItem(tokenKey);
      sessionStorage.removeItem("afc_refresh_token");
      window.location.assign("platform-admin.html");
    });
  });
}());
