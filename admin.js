(() => {
    "use strict";

    const api = window.NNMRCN_API;
    const TOKEN_KEY = "nnmrcn_admin_token";

    const form = document.getElementById("adminLoginForm");
    const tokenInput = document.getElementById("adminToken");
    const statusText = document.getElementById("adminStatus");
    const panel = document.getElementById("adminPanel");
    const list = document.getElementById("adminList");
    const contactList = document.getElementById("adminContactList");
    const memorySection = document.getElementById("adminMemorie");
    const memoryList = document.getElementById("adminMemoryList");
    const memoryFilter = document.getElementById("adminMemoryStatusFilter");
    const memoryRefresh = document.getElementById("adminMemoryRefresh");
    const filter = document.getElementById("adminStatusFilter");
    const refresh = document.getElementById("adminRefresh");
    const pushButton = document.getElementById("adminPushButton");
    const pushStatus = document.getElementById("adminPushStatus");
    const search = document.getElementById("adminSearch");
    const exportCsv = document.getElementById("adminExportCsv");
    const exportJson = document.getElementById("adminExportJson");
    const exportStatus = document.getElementById("adminExportStatus");
    const countPending = document.getElementById("adminCountPending");
    const countDelivery = document.getElementById("adminCountDelivery");
    const countPublishable = document.getElementById("adminCountPublishable");
    const countPublic = document.getElementById("adminCountPublic");
    const countContacts = document.getElementById("adminCountContacts");
    const countMemories = document.getElementById("adminCountMemories");
    const countPublicMemories = document.getElementById(
        "adminCountPublicMemories"
    );
    const welcomePreview = document.getElementById("adminWelcomePreview");
    const cmsPageForm = document.getElementById("adminPageForm");
    const cmsPageSelect = document.getElementById("adminPageSelect");
    const cmsPageTitle = document.getElementById("adminPageTitle");
    const cmsPageDescription = document.getElementById("adminPageDescription");
    const cmsPagePublicationStatus = document.getElementById(
        "adminPagePublicationStatus"
    );
    const cmsPageBlocks = document.getElementById("adminPageBlocks");
    const cmsPageOpen = document.getElementById("adminPageOpen");
    const cmsPageSubmit = document.getElementById("adminPageSubmit");
    const cmsPageReload = document.getElementById("adminPageReload");
    const cmsPageStatus = document.getElementById("adminPageStatus");
    const cmsPoemForm = document.getElementById("adminPoemForm");
    const cmsPoemTitle = document.getElementById("adminPoemTitle");
    const cmsPoemSubtitle = document.getElementById("adminPoemSubtitle");
    const cmsPoemPublicationStatus = document.getElementById(
        "adminPoemPublicationStatus"
    );
    const cmsPoemSections = document.getElementById("adminPoemSections");
    const cmsPoemSubmit = document.getElementById("adminPoemSubmit");
    const cmsPoemReload = document.getElementById("adminPoemReload");
    const cmsPoemStatus = document.getElementById("adminPoemStatus");
    const cmsNavigationForm = document.getElementById("adminNavigationForm");
    const cmsNavigationItems = document.getElementById("adminNavigationItems");
    const cmsNavigationSubmit = document.getElementById("adminNavigationSubmit");
    const cmsNavigationReload = document.getElementById("adminNavigationReload");
    const cmsNavigationStatus = document.getElementById("adminNavigationStatus");
    const cmsOnboardingForm = document.getElementById("adminOnboardingForm");
    const cmsOnboardingTitle = document.getElementById("adminOnboardingTitle");
    const cmsOnboardingSubtitle = document.getElementById("adminOnboardingSubtitle");
    const cmsOnboardingStatus = document.getElementById("adminOnboardingStatus");
    const cmsOnboardingSteps = document.getElementById("adminOnboardingSteps");
    const cmsOnboardingSubmit = document.getElementById("adminOnboardingSubmit");
    const cmsOnboardingReload = document.getElementById("adminOnboardingReload");
    const cmsOnboardingStatusText = document.getElementById(
        "adminOnboardingStatusText"
    );
    const cmsMapLayerForm = document.getElementById("adminMapLayerForm");
    const cmsMapLayerSelect = document.getElementById("adminMapLayerSelect");
    const cmsMapLayerIdentity = document.getElementById("adminMapLayerIdentity");
    const cmsMapLayerTitle = document.getElementById("adminMapLayerTitle");
    const cmsMapLayerDescription = document.getElementById(
        "adminMapLayerDescription"
    );
    const cmsMapLayerPublicationStatus = document.getElementById(
        "adminMapLayerPublicationStatus"
    );
    const cmsMapLayerStyle = document.getElementById("adminMapLayerStyle");
    const cmsMapLayerSubmit = document.getElementById("adminMapLayerSubmit");
    const cmsMapLayerReload = document.getElementById("adminMapLayerReload");
    const cmsMapLayerStatus = document.getElementById("adminMapLayerStatus");
    const cmsMapFeatureForm = document.getElementById("adminMapFeatureForm");
    const cmsMapFeatureSelect = document.getElementById("adminMapFeatureSelect");
    const cmsMapFeatureLayer = document.getElementById("adminMapFeatureLayer");
    const cmsMapFeaturePosition = document.getElementById(
        "adminMapFeaturePosition"
    );
    const cmsMapFeatureTitle = document.getElementById("adminMapFeatureTitle");
    const cmsMapFeatureDescription = document.getElementById(
        "adminMapFeatureDescription"
    );
    const cmsMapFeaturePublicationStatus = document.getElementById(
        "adminMapFeaturePublicationStatus"
    );
    const cmsMapFeatureGeometry = document.getElementById(
        "adminMapFeatureGeometry"
    );
    const cmsMapFeatureProperties = document.getElementById(
        "adminMapFeatureProperties"
    );
    const cmsMapFeatureSubmit = document.getElementById("adminMapFeatureSubmit");
    const cmsMapFeatureReset = document.getElementById("adminMapFeatureReset");
    const cmsMapFeatureReload = document.getElementById("adminMapFeatureReload");
    const cmsMapFeatureStatus = document.getElementById("adminMapFeatureStatus");
    const cmsSourceForm = document.getElementById("adminSourceForm");
    const cmsSourceSelect = document.getElementById("adminSourceSelect");
    const cmsSourceIdentity = document.getElementById("adminSourceIdentity");
    const cmsSourceType = document.getElementById("adminSourceType");
    const cmsSourceTitle = document.getElementById("adminSourceTitle");
    const cmsSourceAuthor = document.getElementById("adminSourceAuthor");
    const cmsSourcePublicationDate = document.getElementById(
        "adminSourcePublicationDate"
    );
    const cmsSourceUrl = document.getElementById("adminSourceUrl");
    const cmsSourceNote = document.getElementById("adminSourceNote");
    const cmsSourcePublicationStatus = document.getElementById(
        "adminSourcePublicationStatus"
    );
    const cmsSourceLinks = document.getElementById("adminSourceLinks");
    const cmsSourceSubmit = document.getElementById("adminSourceSubmit");
    const cmsSourceReset = document.getElementById("adminSourceReset");
    const cmsSourceReload = document.getElementById("adminSourceReload");
    const cmsSourceStatus = document.getElementById("adminSourceStatus");
    const cmsSettingForm = document.getElementById("adminSettingForm");
    const cmsSettingSelect = document.getElementById("adminSettingSelect");
    const cmsSettingIdentity = document.getElementById("adminSettingIdentity");
    const cmsSettingValue = document.getElementById("adminSettingValue");
    const cmsSettingPublicationStatus = document.getElementById(
        "adminSettingPublicationStatus"
    );
    const cmsSettingSubmit = document.getElementById("adminSettingSubmit");
    const cmsSettingReload = document.getElementById("adminSettingReload");
    const cmsSettingStatus = document.getElementById("adminSettingStatus");
    const cmsSeoForm = document.getElementById("adminSeoForm");
    const cmsSeoPage = document.getElementById("adminSeoPage");
    const cmsSeoIdentity = document.getElementById("adminSeoIdentity");
    const cmsSeoTitle = document.getElementById("adminSeoTitle");
    const cmsSeoDescription = document.getElementById("adminSeoDescription");
    const cmsSeoImage = document.getElementById("adminSeoImage");
    const cmsSeoPublicationStatus = document.getElementById(
        "adminSeoPublicationStatus"
    );
    const cmsSeoPreview = document.getElementById("adminSeoPreview");
    const cmsSeoSubmit = document.getElementById("adminSeoSubmit");
    const cmsSeoReload = document.getElementById("adminSeoReload");
    const cmsSeoStatus = document.getElementById("adminSeoStatus");
    const cmsLegalForm = document.getElementById("adminLegalForm");
    const cmsLegalDocumentSelect = document.getElementById(
        "adminLegalDocumentSelect"
    );
    const cmsLegalVersionSelect = document.getElementById(
        "adminLegalVersionSelect"
    );
    const cmsLegalIdentity = document.getElementById("adminLegalIdentity");
    const cmsLegalEffectiveDate = document.getElementById(
        "adminLegalEffectiveDate"
    );
    const cmsLegalBody = document.getElementById("adminLegalBody");
    const cmsLegalSave = document.getElementById("adminLegalSave");
    const cmsLegalNew = document.getElementById("adminLegalNew");
    const cmsLegalPublish = document.getElementById("adminLegalPublish");
    const cmsLegalReload = document.getElementById("adminLegalReload");
    const cmsLegalStatus = document.getElementById("adminLegalStatus");
    const cmsPermalinkForm = document.getElementById("adminPermalinkForm");
    const cmsPermalinkSelect = document.getElementById("adminPermalinkSelect");
    const cmsPermalinkIdentity = document.getElementById(
        "adminPermalinkIdentity"
    );
    const cmsPermalinkPath = document.getElementById("adminPermalinkPath");
    const cmsPermalinkTargetType = document.getElementById(
        "adminPermalinkTargetType"
    );
    const cmsPermalinkTargetId = document.getElementById(
        "adminPermalinkTargetId"
    );
    const cmsPermalinkState = document.getElementById("adminPermalinkState");
    const cmsPermalinkRedirect = document.getElementById(
        "adminPermalinkRedirect"
    );
    const cmsPermalinkSubmit = document.getElementById("adminPermalinkSubmit");
    const cmsPermalinkNew = document.getElementById("adminPermalinkNew");
    const cmsPermalinkReload = document.getElementById("adminPermalinkReload");
    const cmsPermalinkStatus = document.getElementById("adminPermalinkStatus");
    const cmsPreviewSelect = document.getElementById("adminPreviewSelect");
    const cmsPreviewReload = document.getElementById("adminPreviewReload");
    const cmsPreviewIdentity = document.getElementById("adminPreviewIdentity");
    const cmsPreviewContent = document.getElementById("adminPreviewContent");
    const cmsPreviewStatus = document.getElementById("adminPreviewStatus");
    const cmsRevisionRestore = document.getElementById("adminRevisionRestore");
    const cmsRevisionCompare = document.getElementById("adminRevisionCompare");
    const cmsRevisionComparison = document.getElementById(
        "adminRevisionComparison"
    );
    const cmsRevisionRestoreButton = document.getElementById(
        "adminRevisionRestoreButton"
    );
    const cmsRevisionReload = document.getElementById("adminRevisionReload");
    const cmsRevisionStatus = document.getElementById("adminRevisionStatus");
    const mapEntryForm = document.getElementById("adminMapEntryForm");
    const mapEntryName = document.getElementById("adminMapEntryName");
    const mapEntryCategory = document.getElementById("adminMapEntryCategory");
    const mapEntryDescription = document.getElementById(
        "adminMapEntryDescription"
    );
    const mapEntryImageInput = document.getElementById("adminMapEntryImage");
    const mapEntryImagePreview = document.getElementById(
        "adminMapEntryImagePreview"
    );
    const mapEntryImagePreviewImg = document.getElementById(
        "adminMapEntryImagePreviewImg"
    );
    const mapEntryImageRemove = document.getElementById(
        "adminMapEntryImageRemove"
    );
    const mapEntryLat = document.getElementById("adminMapEntryLat");
    const mapEntryLon = document.getElementById("adminMapEntryLon");
    const mapEntrySourceUrl = document.getElementById("adminMapEntrySourceUrl");
    const mapEntrySourceLabel = document.getElementById(
        "adminMapEntrySourceLabel"
    );
    const mapEntrySubmit = document.getElementById("adminMapEntrySubmit");
    const mapEntryCancel = document.getElementById("adminMapEntryCancel");
    const mapEntryStatus = document.getElementById("adminMapEntryStatus");
    const mapEntryList = document.getElementById("adminMapEntryList");
    const narrativeForm = document.getElementById("adminNarrativeForm");
    const narrativePosition = document.getElementById("adminNarrativePosition");
    const narrativeVerse = document.getElementById("adminNarrativeVerse");
    const narrativeLabel = document.getElementById("adminNarrativeLabel");
    const narrativeTitle = document.getElementById("adminNarrativeTitle");
    const narrativeTitleUrl = document.getElementById("adminNarrativeTitleUrl");
    const narrativeText = document.getElementById("adminNarrativeText");
    const narrativeSources = document.getElementById("adminNarrativeSources");
    const narrativeLat = document.getElementById("adminNarrativeLat");
    const narrativeLon = document.getElementById("adminNarrativeLon");
    const narrativeZoom = document.getElementById("adminNarrativeZoom");
    const narrativePublished = document.getElementById("adminNarrativePublished");
    const narrativeSubmit = document.getElementById("adminNarrativeSubmit");
    const narrativeCancel = document.getElementById("adminNarrativeCancel");
    const narrativeStatus = document.getElementById("adminNarrativeStatus");
    const narrativeList = document.getElementById("adminNarrativeList");

    let adminToken = sessionStorage.getItem(TOKEN_KEY) || "";
    let loadedMessages = [];
    let memoryObjectUrls = [];
    let mapEntryMap = null;
    let mapEntryMarker = null;
    let mapEntryResizeObserver = null;
    let editingMapEntryId = null;
    let editingMapEntryHasImage = false;
    let mapEntryImage = null;
    let mapEntryImageRemoved = false;
    let mapEntryImageObjectUrl = "";
    let narrativeMap = null;
    let narrativeMarker = null;
    let narrativeResizeObserver = null;
    let editingNarrativeId = null;
    let loadedNarrativeSteps = [];
    let loadedCmsPages = [];
    let loadedCmsPoem = null;
    let loadedCmsNavigation = null;
    let loadedCmsOnboarding = null;
    let loadedCmsMapLayers = [];
    let loadedCmsSources = [];
    let loadedCmsSettings = [];
    let loadedCmsLegalDocuments = [];
    let loadedCmsPermalinks = [];
    let loadedCmsPreviews = [];
    let loadedCmsRevisions = [];

    const pushNotifications = window.NNMRCN_NOTIFICHE.create({
        button: pushButton,
        status: pushStatus,
        request,
        identity: () => adminToken ? "admin" : ""
    });

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set("X-Admin-Token", adminToken);

        return api.request(path, {
            ...options,
            headers
        });
    }

    function showListMessage(message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        list.replaceChildren(paragraph);
    }

    async function loadMessages() {
        showListMessage("Caricamento…");

        try {
            const data = await request(
                `/api/admin/messages?status=${encodeURIComponent(filter.value)}`
            );

            loadedMessages = data.messages || [];
            renderCurrentMessages();
            panel.hidden = false;
            statusText.textContent = "";
            await Promise.all([
                loadContactMessages(),
                loadMemories(),
                loadMapEntries(),
                loadNarrativeSteps(),
                loadCmsPages(),
                loadCmsPoem(),
                loadCmsNavigation(),
                loadCmsOnboarding(),
                loadCmsMapLayers(),
                loadCmsSources(),
                loadCmsSettings(),
                loadCmsLegal(),
                loadCmsPermalinks(),
                loadCmsPreviews(),
                loadSummary(),
                pushNotifications.sync()
            ]);
        } catch (error) {
            if (error.status === 401) {
                panel.hidden = true;
                statusText.textContent = "Token non valido.";
                sessionStorage.removeItem(TOKEN_KEY);
                adminToken = "";
                pushNotifications.reset();
            } else {
                showListMessage("Errore nel caricamento.");
            }
        }
    }

    function renderCurrentMessages() {
        const query = search.value.trim().toLocaleLowerCase("it");
        const visible = query
            ? loadedMessages.filter((message) => [
                message.text,
                message.senderAddress,
                message.recipientAddress,
                message.status,
                message.deliveryType
            ].some((value) =>
                String(value || "").toLocaleLowerCase("it").includes(query)
            ))
            : loadedMessages;

        render(visible);
    }

    async function loadSummary() {
        try {
            const data = await request("/api/admin/summary");
            countPending.textContent = String(data.pendingOnline || 0);
            countDelivery.textContent = String(data.pendingDelivery || 0);
            countPublishable.textContent = String(data.publishable || 0);
            countPublic.textContent = String(data.public || 0);
            countContacts.textContent = String(data.unreadContacts || 0);
            countMemories.textContent = String(data.pendingMemories || 0);
            countPublicMemories.textContent = String(data.publicMemories || 0);
        } catch (_) {
            [
                countPending,
                countDelivery,
                countPublishable,
                countPublic,
                countContacts,
                countMemories,
                countPublicMemories
            ].forEach((element) => {
                element.textContent = "–";
            });
        }
    }

    async function loadCmsPages(preferredId = "") {
        const selectedId = preferredId || cmsPageSelect.value;

        cmsPageStatus.textContent = "Caricamento pagine…";

        try {
            const data = await request("/api/admin/cms/pages");
            loadedCmsPages = data.pages || [];
            cmsPageSelect.replaceChildren();

            for (const page of loadedCmsPages) {
                const option = document.createElement("option");

                option.value = page.id;
                option.textContent = page.title;
                cmsPageSelect.appendChild(option);
            }

            if (loadedCmsPages.some((page) => page.id === selectedId)) {
                cmsPageSelect.value = selectedId;
            }

            renderCmsPageForm();
            cmsPageStatus.textContent = loadedCmsPages.length
                ? ""
                : "Nessuna pagina disponibile.";
        } catch (error) {
            cmsPageStatus.textContent =
                error.message || "Non è stato possibile caricare le pagine.";
        }
    }

    function selectedCmsPage() {
        return loadedCmsPages.find((page) => page.id === cmsPageSelect.value);
    }

    function renderCmsPageForm() {
        const page = selectedCmsPage();

        cmsPageBlocks.replaceChildren();

        if (!page) {
            cmsPageTitle.value = "";
            cmsPageDescription.value = "";
            cmsPageSubmit.disabled = true;
            return;
        }

        cmsPageTitle.value = page.title;
        cmsPageDescription.value = page.description;
        cmsPagePublicationStatus.value = page.status;
        cmsPageOpen.href = `./${page.slug}.html`;
        cmsPageSubmit.disabled = false;

        for (const block of page.blocks || []) {
            const label = document.createElement("label");
            const heading = document.createElement("span");
            const textarea = document.createElement("textarea");

            heading.textContent =
                `${block.position}. ${block.type} — ${block.id}`;
            textarea.value = block.text;
            textarea.rows = Math.min(
                12,
                Math.max(2, String(block.text || "").split("\n").length + 1)
            );
            textarea.maxLength = 20000;
            textarea.dataset.cmsPageBlock = block.id;
            label.append(heading, textarea);
            cmsPageBlocks.appendChild(label);
        }
    }

    async function saveCmsPage(event) {
        event.preventDefault();

        const page = selectedCmsPage();

        if (!page) {
            return;
        }

        const blockFields = Array.from(
            cmsPageBlocks.querySelectorAll("[data-cms-page-block]")
        );

        cmsPageSubmit.disabled = true;
        cmsPageReload.disabled = true;
        cmsPageStatus.textContent = `Salvataggio di «${page.title}»…`;

        try {
            const data = await request(
                `/api/admin/cms/pages/${encodeURIComponent(page.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        title: cmsPageTitle.value,
                        description: cmsPageDescription.value,
                        status: cmsPagePublicationStatus.value,
                        expectedUpdatedAt: page.updatedAt,
                        blocks: blockFields.map((field) => ({
                            id: field.dataset.cmsPageBlock,
                            text: field.value
                        }))
                    })
                }
            );

            const message = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Pagina salvata e revisione registrata.";
            await loadCmsPages(page.id);
            cmsPageStatus.textContent = message;
        } catch (error) {
            cmsPageStatus.textContent =
                error.message || "Non è stato possibile salvare la pagina.";
        } finally {
            cmsPageSubmit.disabled = false;
            cmsPageReload.disabled = false;
        }
    }

    async function loadCmsPoem() {
        cmsPoemStatus.textContent = "Caricamento poesia…";

        try {
            const data = await request("/api/admin/cms/poem");
            loadedCmsPoem = data.poem || null;
            renderCmsPoemForm();
            cmsPoemStatus.textContent = loadedCmsPoem
                ? ""
                : "Poesia non disponibile.";
        } catch (error) {
            cmsPoemStatus.textContent =
                error.message || "Non è stato possibile caricare la poesia.";
        }
    }

    function renderCmsPoemForm() {
        const poem = loadedCmsPoem;

        cmsPoemSections.replaceChildren();

        if (!poem) {
            cmsPoemSubmit.disabled = true;
            return;
        }

        cmsPoemTitle.value = poem.title;
        cmsPoemSubtitle.value = poem.subtitle;
        cmsPoemPublicationStatus.value = poem.status;
        cmsPoemSubmit.disabled = false;

        for (const section of poem.sections || []) {
            const details = document.createElement("details");
            const summary = document.createElement("summary");
            const lines = document.createElement("div");

            details.className = "admin-poem-section";
            details.open = Number(section.position) === 1;
            summary.textContent =
                `Canto ${section.title} — ${section.lines.length} versi`;
            lines.className = "admin-poem-lines";

            for (const line of section.lines) {
                const row = document.createElement("div");
                const textLabel = document.createElement("label");
                const textHeading = document.createElement("span");
                const textarea = document.createElement("textarea");
                const indentLabel = document.createElement("label");
                const indentSelect = document.createElement("select");

                row.className = "admin-poem-line";
                textHeading.textContent =
                    `Verso ${line.position} · riga ${line.metadata?.metricRow || "–"}`;
                textarea.value = line.text;
                textarea.rows = 2;
                textarea.maxLength = 2000;
                textarea.dataset.cmsPoemLine = line.id;
                textLabel.append(textHeading, textarea);
                indentLabel.textContent = "Rientro";

                for (let indent = 0; indent <= 3; indent += 1) {
                    const option = document.createElement("option");
                    option.value = String(indent);
                    option.textContent = String(indent);
                    indentSelect.appendChild(option);
                }

                indentSelect.value = String(line.indent);
                indentSelect.dataset.cmsPoemIndent = line.id;
                indentLabel.appendChild(indentSelect);
                row.append(textLabel, indentLabel);
                lines.appendChild(row);
            }

            details.append(summary, lines);
            cmsPoemSections.appendChild(details);
        }
    }

    async function saveCmsPoem(event) {
        event.preventDefault();

        if (!loadedCmsPoem) {
            return;
        }

        const lineFields = Array.from(
            cmsPoemSections.querySelectorAll("[data-cms-poem-line]")
        );
        const indentFields = new Map(Array.from(
            cmsPoemSections.querySelectorAll("[data-cms-poem-indent]")
        ).map((field) => [field.dataset.cmsPoemIndent, field]));

        cmsPoemSubmit.disabled = true;
        cmsPoemReload.disabled = true;
        cmsPoemStatus.textContent = "Salvataggio della poesia…";

        try {
            const data = await request("/api/admin/cms/poem", {
                method: "PATCH",
                body: JSON.stringify({
                    title: cmsPoemTitle.value,
                    subtitle: cmsPoemSubtitle.value,
                    status: cmsPoemPublicationStatus.value,
                    expectedUpdatedAt: loadedCmsPoem.updatedAt,
                    lines: lineFields.map((field) => ({
                        id: field.dataset.cmsPoemLine,
                        text: field.value,
                        indent: Number(
                            indentFields.get(field.dataset.cmsPoemLine)?.value
                        )
                    }))
                })
            });
            const message = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Poesia salvata e revisione registrata.";

            await loadCmsPoem();
            cmsPoemStatus.textContent = message;
        } catch (error) {
            cmsPoemStatus.textContent =
                error.message || "Non è stato possibile salvare la poesia.";
        } finally {
            cmsPoemSubmit.disabled = false;
            cmsPoemReload.disabled = false;
        }
    }

    function selectField(value, values, datasetName, id) {
        const select = document.createElement("select");
        for (const optionValue of values) {
            const option = document.createElement("option");
            option.value = optionValue;
            option.textContent = optionValue;
            select.appendChild(option);
        }
        select.value = value;
        select.dataset[datasetName] = id;
        return select;
    }

    async function loadCmsNavigation() {
        cmsNavigationStatus.textContent = "Caricamento menu…";
        try {
            loadedCmsNavigation = await request("/api/admin/cms/navigation");
            cmsNavigationItems.replaceChildren();
            for (const item of loadedCmsNavigation.items || []) {
                const row = document.createElement("fieldset");
                const legend = document.createElement("legend");
                const label = document.createElement("input");
                const href = document.createElement("input");
                legend.textContent = `${item.menuKey} · ${item.position} · ${item.id}`;
                label.value = item.label;
                label.maxLength = 160;
                label.dataset.cmsNavigationLabel = item.id;
                href.value = item.href;
                href.maxLength = 2048;
                href.dataset.cmsNavigationHref = item.id;
                row.append(
                    legend,
                    fieldLabel("Etichetta", label),
                    fieldLabel("Destinazione", href),
                    fieldLabel("Visibilità", selectField(
                        item.visibility, ["public", "authenticated", "admin"],
                        "cmsNavigationVisibility", item.id
                    )),
                    fieldLabel("Stato", selectField(
                        item.status, ["published", "draft"],
                        "cmsNavigationStatus", item.id
                    ))
                );
                cmsNavigationItems.appendChild(row);
            }
            cmsNavigationStatus.textContent = "";
        } catch (error) {
            cmsNavigationStatus.textContent = error.message || "Menu non disponibile.";
        }
    }

    function fieldLabel(text, field) {
        const label = document.createElement("label");
        const span = document.createElement("span");
        span.textContent = text;
        label.append(span, field);
        return label;
    }

    async function saveCmsNavigation(event) {
        event.preventDefault();
        if (!loadedCmsNavigation) return;
        const value = (selector, id) => cmsNavigationItems.querySelector(
            `[${selector}="${id}"]`
        )?.value || "";
        const items = loadedCmsNavigation.items.map((item) => ({
            id: item.id,
            label: value("data-cms-navigation-label", item.id),
            href: value("data-cms-navigation-href", item.id),
            visibility: value("data-cms-navigation-visibility", item.id),
            status: value("data-cms-navigation-status", item.id)
        }));
        cmsNavigationSubmit.disabled = true;
        try {
            const data = await request("/api/admin/cms/navigation", {
                method: "PATCH",
                body: JSON.stringify({
                    expectedUpdatedAt: loadedCmsNavigation.updatedAt,
                    items
                })
            });
            await loadCmsNavigation();
            cmsNavigationStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Menu salvato e revisioni registrate.";
        } catch (error) {
            cmsNavigationStatus.textContent = error.message || "Salvataggio non riuscito.";
        } finally {
            cmsNavigationSubmit.disabled = false;
        }
    }

    async function loadCmsOnboarding() {
        cmsOnboardingStatusText.textContent = "Caricamento benvenuto…";
        try {
            loadedCmsOnboarding = await request("/api/admin/cms/onboarding");
            cmsOnboardingTitle.value = loadedCmsOnboarding.intro.title;
            cmsOnboardingSubtitle.value = loadedCmsOnboarding.intro.subtitle;
            cmsOnboardingStatus.value = loadedCmsOnboarding.intro.status;
            cmsOnboardingSteps.replaceChildren();
            for (const step of loadedCmsOnboarding.steps || []) {
                const row = document.createElement("fieldset");
                const legend = document.createElement("legend");
                const title = document.createElement("input");
                const description = document.createElement("textarea");
                const details = document.createElement("textarea");
                const preview = document.createElement("input");
                const alt = document.createElement("textarea");
                legend.textContent = `${step.position}. ${step.id}`;
                title.value = step.title;
                title.dataset.cmsOnboardingTitle = step.id;
                description.value = step.description;
                description.rows = 4;
                description.dataset.cmsOnboardingDescription = step.id;
                details.value = step.details.join("\n");
                details.rows = 4;
                details.dataset.cmsOnboardingDetails = step.id;
                preview.value = step.preview;
                preview.dataset.cmsOnboardingPreview = step.id;
                alt.value = step.alt;
                alt.rows = 3;
                alt.dataset.cmsOnboardingAlt = step.id;
                row.append(
                    legend,
                    fieldLabel("Titolo", title),
                    fieldLabel("Descrizione", description),
                    fieldLabel("Punti, uno per riga", details),
                    fieldLabel("Destinazione anteprima", preview),
                    fieldLabel("Descrizione accessibile", alt),
                    fieldLabel("Stato", selectField(
                        step.status, ["published", "draft"],
                        "cmsOnboardingStepStatus", step.id
                    ))
                );
                cmsOnboardingSteps.appendChild(row);
            }
            cmsOnboardingStatusText.textContent = "";
        } catch (error) {
            cmsOnboardingStatusText.textContent =
                error.message || "Benvenuto non disponibile.";
        }
    }

    async function saveCmsOnboarding(event) {
        event.preventDefault();
        if (!loadedCmsOnboarding) return;
        const value = (name, id) => cmsOnboardingSteps.querySelector(
            `[data-${name}="${id}"]`
        )?.value || "";
        const steps = loadedCmsOnboarding.steps.map((step) => ({
            id: step.id,
            title: value("cms-onboarding-title", step.id),
            description: value("cms-onboarding-description", step.id),
            details: value("cms-onboarding-details", step.id)
                .split("\n").map((line) => line.trim()).filter(Boolean),
            preview: value("cms-onboarding-preview", step.id),
            alt: value("cms-onboarding-alt", step.id),
            status: value("cms-onboarding-step-status", step.id)
        }));
        cmsOnboardingSubmit.disabled = true;
        try {
            const data = await request("/api/admin/cms/onboarding", {
                method: "PATCH",
                body: JSON.stringify({
                    expectedUpdatedAt: loadedCmsOnboarding.updatedAt,
                    intro: {
                        title: cmsOnboardingTitle.value,
                        subtitle: cmsOnboardingSubtitle.value,
                        status: cmsOnboardingStatus.value
                    },
                    steps
                })
            });
            await loadCmsOnboarding();
            cmsOnboardingStatusText.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Benvenuto salvato e revisioni registrate.";
        } catch (error) {
            cmsOnboardingStatusText.textContent =
                error.message || "Salvataggio non riuscito.";
        } finally {
            cmsOnboardingSubmit.disabled = false;
        }
    }

    function cmsMapFeatures() {
        return loadedCmsMapLayers.flatMap((layer) => layer.features || []);
    }

    function selectedCmsMapLayer() {
        return loadedCmsMapLayers.find(
            (layer) => layer.id === cmsMapLayerSelect.value
        );
    }

    function selectedCmsMapFeature() {
        return cmsMapFeatures().find(
            (feature) => feature.id === cmsMapFeatureSelect.value
        );
    }

    function fillCmsMapLayerSelect(select, selectedId) {
        select.replaceChildren();

        for (const layer of loadedCmsMapLayers) {
            const option = document.createElement("option");
            option.value = layer.id;
            option.textContent = `${layer.position}. ${layer.title}`;
            select.appendChild(option);
        }

        if (loadedCmsMapLayers.some((layer) => layer.id === selectedId)) {
            select.value = selectedId;
        }
    }

    async function loadCmsMapLayers(
        preferredLayerId = "",
        preferredFeatureId = ""
    ) {
        const layerId = preferredLayerId || cmsMapLayerSelect.value;
        const featureId = preferredFeatureId || cmsMapFeatureSelect.value;
        cmsMapLayerStatus.textContent = "Caricamento livelli…";
        cmsMapFeatureStatus.textContent = "Caricamento geometrie…";

        try {
            const data = await request("/api/admin/cms/map-layers");
            loadedCmsMapLayers = data.layers || [];
            fillCmsMapLayerSelect(cmsMapLayerSelect, layerId);
            fillCmsMapLayerSelect(
                cmsMapFeatureLayer,
                selectedCmsMapFeature()?.layerId || layerId
            );
            renderCmsMapLayerForm();
            renderCmsMapFeatureSelect(featureId);
            renderCmsMapFeatureForm();
            cmsMapLayerStatus.textContent = loadedCmsMapLayers.length
                ? ""
                : "Nessun livello disponibile.";
            cmsMapFeatureStatus.textContent = "";
        } catch (error) {
            const message = error.message ||
                "Non è stato possibile caricare livelli e geometrie.";
            cmsMapLayerStatus.textContent = message;
            cmsMapFeatureStatus.textContent = message;
        }
    }

    function renderCmsMapLayerForm() {
        const layer = selectedCmsMapLayer();

        if (!layer) {
            cmsMapLayerIdentity.textContent = "";
            cmsMapLayerTitle.value = "";
            cmsMapLayerDescription.value = "";
            cmsMapLayerStyle.value = "{}";
            cmsMapLayerSubmit.disabled = true;
            return;
        }

        cmsMapLayerIdentity.textContent =
            `${layer.id} · /${layer.slug} · ${layer.type} · posizione ${layer.position}`;
        cmsMapLayerTitle.value = layer.title;
        cmsMapLayerDescription.value = layer.description;
        cmsMapLayerPublicationStatus.value = layer.status;
        cmsMapLayerStyle.value = JSON.stringify(layer.style || {}, null, 2);
        cmsMapLayerSubmit.disabled = false;
    }

    function renderCmsMapFeatureSelect(preferredId = "") {
        const features = cmsMapFeatures();
        const newOption = document.createElement("option");
        newOption.value = "";
        newOption.textContent = "Nuova geometria";
        cmsMapFeatureSelect.replaceChildren(newOption);

        for (const layer of loadedCmsMapLayers) {
            for (const feature of layer.features || []) {
                const option = document.createElement("option");
                option.value = feature.id;
                option.textContent = `${layer.title} — ${feature.position}. ${feature.title}` +
                    (feature.status === "archived" ? " [archiviata]" : "");
                cmsMapFeatureSelect.appendChild(option);
            }
        }

        cmsMapFeatureSelect.value = features.some(
            (feature) => feature.id === preferredId
        ) ? preferredId : "";
    }

    function nextCmsMapFeaturePosition(layerId) {
        const positions = cmsMapFeatures()
            .filter((feature) => feature.layerId === layerId)
            .map((feature) => Number(feature.position) || 0);
        return Math.max(0, ...positions) + 1;
    }

    function renderCmsMapFeatureForm() {
        const feature = selectedCmsMapFeature();

        if (!feature) {
            const layerId = selectedCmsMapLayer()?.id ||
                loadedCmsMapLayers[0]?.id || "";
            cmsMapFeatureLayer.value = layerId;
            cmsMapFeaturePosition.value = String(
                nextCmsMapFeaturePosition(layerId)
            );
            cmsMapFeatureTitle.value = "";
            cmsMapFeatureDescription.value = "";
            cmsMapFeaturePublicationStatus.value = "draft";
            cmsMapFeatureGeometry.value = "";
            cmsMapFeatureProperties.value = "{}";
            cmsMapFeatureSubmit.textContent = "Crea geometria";
            return;
        }

        cmsMapFeatureLayer.value = feature.layerId;
        cmsMapFeaturePosition.value = String(feature.position);
        cmsMapFeatureTitle.value = feature.title;
        cmsMapFeatureDescription.value = feature.description;
        cmsMapFeaturePublicationStatus.value = feature.status;
        cmsMapFeatureGeometry.value = feature.geometry === null
            ? ""
            : JSON.stringify(feature.geometry, null, 2);
        cmsMapFeatureProperties.value = JSON.stringify(
            feature.properties || {},
            null,
            2
        );
        cmsMapFeatureSubmit.textContent = "Salva geometria";
        cmsMapFeatureStatus.textContent = feature.status === "archived"
            ? "Geometria archiviata: non è visibile nella mappa pubblica."
            : "";
    }

    function parseCmsMapJson(value, label, allowEmpty = false) {
        const source = String(value || "").trim();

        if (!source && allowEmpty) {
            return null;
        }

        try {
            const parsed = JSON.parse(source);
            if (parsed === null || typeof parsed !== "object" ||
                Array.isArray(parsed)) {
                throw new Error();
            }
            return parsed;
        } catch (_) {
            throw new Error(`${label} deve contenere un oggetto JSON valido.`);
        }
    }

    async function saveCmsMapLayer(event) {
        event.preventDefault();
        const layer = selectedCmsMapLayer();

        if (!layer) return;
        cmsMapLayerSubmit.disabled = true;
        cmsMapLayerReload.disabled = true;
        cmsMapLayerStatus.textContent = `Salvataggio di «${layer.title}»…`;

        try {
            const data = await request(
                `/api/admin/cms/map-layers/${encodeURIComponent(layer.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        title: cmsMapLayerTitle.value,
                        description: cmsMapLayerDescription.value,
                        style: parseCmsMapJson(
                            cmsMapLayerStyle.value,
                            "Lo stile"
                        ),
                        status: cmsMapLayerPublicationStatus.value,
                        expectedUpdatedAt: layer.updatedAt
                    })
                }
            );
            await loadCmsMapLayers(layer.id, cmsMapFeatureSelect.value);
            cmsMapLayerStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Livello salvato e revisione registrata.";
        } catch (error) {
            cmsMapLayerStatus.textContent =
                error.message || "Non è stato possibile salvare il livello.";
        } finally {
            cmsMapLayerSubmit.disabled = false;
            cmsMapLayerReload.disabled = false;
        }
    }

    async function saveCmsMapFeature(event) {
        event.preventDefault();
        const feature = selectedCmsMapFeature();
        cmsMapFeatureSubmit.disabled = true;
        cmsMapFeatureReset.disabled = true;
        cmsMapFeatureReload.disabled = true;
        cmsMapFeatureStatus.textContent = feature
            ? `Salvataggio di «${feature.title}»…`
            : "Creazione della geometria…";

        try {
            const body = {
                layerId: cmsMapFeatureLayer.value,
                position: Number(cmsMapFeaturePosition.value),
                title: cmsMapFeatureTitle.value,
                description: cmsMapFeatureDescription.value,
                status: cmsMapFeaturePublicationStatus.value,
                geometry: parseCmsMapJson(
                    cmsMapFeatureGeometry.value,
                    "La geometria",
                    true
                ),
                properties: parseCmsMapJson(
                    cmsMapFeatureProperties.value,
                    "Le proprietà"
                )
            };
            if (feature) {
                body.expectedUpdatedAt = feature.updatedAt;
            }
            const data = await request(feature
                ? `/api/admin/cms/map-features/${encodeURIComponent(feature.id)}`
                : "/api/admin/cms/map-features", {
                method: feature ? "PATCH" : "POST",
                body: JSON.stringify(body)
            });
            await loadCmsMapLayers(data.feature.layerId, data.feature.id);
            cmsMapFeatureStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : feature
                    ? "Geometria salvata e revisione registrata."
                    : "Geometria creata con un nuovo identificativo stabile.";
        } catch (error) {
            cmsMapFeatureStatus.textContent = error.message ||
                "Non è stato possibile salvare la geometria.";
        } finally {
            cmsMapFeatureSubmit.disabled = false;
            cmsMapFeatureReset.disabled = false;
            cmsMapFeatureReload.disabled = false;
        }
    }

    function selectedCmsSource() {
        return loadedCmsSources.find(
            (source) => source.id === cmsSourceSelect.value
        );
    }

    async function loadCmsSources(preferredId = "") {
        const selectedId = preferredId || cmsSourceSelect.value;
        cmsSourceStatus.textContent = "Caricamento fonti…";
        try {
            const data = await request("/api/admin/cms/sources");
            loadedCmsSources = data.sources || [];
            const newOption = document.createElement("option");
            newOption.value = "";
            newOption.textContent = "Nuova fonte";
            cmsSourceSelect.replaceChildren(newOption);
            for (const source of loadedCmsSources) {
                const option = document.createElement("option");
                option.value = source.id;
                option.textContent = `${source.title} — ${source.type}`;
                cmsSourceSelect.appendChild(option);
            }
            cmsSourceSelect.value = loadedCmsSources.some(
                (source) => source.id === selectedId
            ) ? selectedId : "";
            renderCmsSourceForm();
            cmsSourceStatus.textContent = "";
        } catch (error) {
            cmsSourceStatus.textContent = error.message ||
                "Non è stato possibile caricare le fonti.";
        }
    }

    function renderCmsSourceForm() {
        const source = selectedCmsSource();
        cmsSourceIdentity.textContent = source
            ? `${source.id} · ${source.links.length} collegamenti protetti`
            : "Il nuovo identificativo stabile verrà creato al salvataggio.";
        cmsSourceType.value = source?.type || "web";
        cmsSourceTitle.value = source?.title || "";
        cmsSourceAuthor.value = source?.author || "";
        cmsSourcePublicationDate.value = source?.publicationDate || "";
        cmsSourceUrl.value = source?.url || "";
        cmsSourceNote.value = source?.note || "";
        cmsSourcePublicationStatus.value = source?.status || "draft";
        cmsSourceLinks.textContent = source?.links.length
            ? "Usata da: " + source.links.map((link) =>
                `${link.contentType}/${link.contentId}`
            ).join(", ")
            : "Nessuna associazione ai contenuti.";
        cmsSourceSubmit.textContent = source ? "Salva fonte" : "Crea fonte";
    }

    async function saveCmsSource(event) {
        event.preventDefault();
        const source = selectedCmsSource();
        cmsSourceSubmit.disabled = true;
        cmsSourceReset.disabled = true;
        cmsSourceReload.disabled = true;
        try {
            const body = {
                type: cmsSourceType.value,
                title: cmsSourceTitle.value,
                author: cmsSourceAuthor.value,
                publicationDate: cmsSourcePublicationDate.value,
                url: cmsSourceUrl.value,
                note: cmsSourceNote.value,
                status: cmsSourcePublicationStatus.value
            };
            if (source) body.expectedUpdatedAt = source.updatedAt;
            const data = await request(source
                ? `/api/admin/cms/sources/${encodeURIComponent(source.id)}`
                : "/api/admin/cms/sources", {
                method: source ? "PATCH" : "POST",
                body: JSON.stringify(body)
            });
            await loadCmsSources(data.source.id);
            cmsSourceStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : source
                    ? "Fonte salvata e revisione registrata."
                    : "Fonte creata con un nuovo identificativo stabile.";
        } catch (error) {
            cmsSourceStatus.textContent = error.message ||
                "Non è stato possibile salvare la fonte.";
        } finally {
            cmsSourceSubmit.disabled = false;
            cmsSourceReset.disabled = false;
            cmsSourceReload.disabled = false;
        }
    }

    function selectedCmsSetting() {
        return loadedCmsSettings.find(
            (setting) => setting.key === cmsSettingSelect.value
        );
    }

    async function loadCmsSettings(preferredKey = "") {
        const selectedKey = preferredKey || cmsSettingSelect.value;
        cmsSettingStatus.textContent = "Caricamento impostazioni…";
        try {
            const data = await request("/api/admin/cms/settings");
            loadedCmsSettings = data.settings || [];
            cmsSettingSelect.replaceChildren();
            for (const setting of loadedCmsSettings) {
                const option = document.createElement("option");
                option.value = setting.key;
                option.textContent = setting.key;
                cmsSettingSelect.appendChild(option);
            }
            if (loadedCmsSettings.some(
                (setting) => setting.key === selectedKey
            )) cmsSettingSelect.value = selectedKey;
            renderCmsSettingForm();
            renderCmsSeoForm();
            cmsSettingStatus.textContent = "";
        } catch (error) {
            cmsSettingStatus.textContent = error.message ||
                "Non è stato possibile caricare le impostazioni.";
        }
    }

    function renderCmsSettingForm() {
        const setting = selectedCmsSetting();
        cmsSettingIdentity.textContent = setting
            ? `${setting.key} · ${setting.visibility} · ${setting.status}`
            : "Nessuna impostazione editoriale disponibile.";
        cmsSettingValue.value = setting
            ? JSON.stringify(setting.value, null, 2)
            : "{}";
        cmsSettingPublicationStatus.value = setting?.status || "draft";
        cmsSettingSubmit.disabled = !setting;
    }

    async function saveCmsSetting(event) {
        event.preventDefault();
        const setting = selectedCmsSetting();
        if (!setting) return;
        cmsSettingSubmit.disabled = true;
        cmsSettingReload.disabled = true;
        try {
            const value = parseCmsMapJson(
                cmsSettingValue.value,
                "Il valore editoriale"
            );
            const data = await request(
                `/api/admin/cms/settings/${encodeURIComponent(setting.key)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        value,
                        status: cmsSettingPublicationStatus.value,
                        expectedUpdatedAt: setting.updatedAt
                    })
                }
            );
            await loadCmsSettings(setting.key);
            cmsSettingStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Impostazione salvata e revisione registrata.";
        } catch (error) {
            cmsSettingStatus.textContent = error.message ||
                "Non è stato possibile salvare l’impostazione.";
        } finally {
            cmsSettingSubmit.disabled = false;
            cmsSettingReload.disabled = false;
        }
    }

    function cmsSeoSetting() {
        return loadedCmsSettings.find(
            (setting) => setting.key === "site.metadata.pages"
        );
    }

    function cmsSeoPageLabel(key) {
        const indexable = new Set([
            "index", "autore", "progetto", "spazio-pubblico", "memorie",
            "archivio", "voci", "logo", "privacy"
        ]);
        return `${key}.html — ${indexable.has(key) ? "indicizzabile" : "noindex"}`;
    }

    function renderCmsSeoForm(preferredPage = "") {
        const setting = cmsSeoSetting();
        const selectedPage = preferredPage || cmsSeoPage.value;
        cmsSeoPage.replaceChildren();
        for (const key of Object.keys(setting?.value || {}).sort()) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = cmsSeoPageLabel(key);
            cmsSeoPage.appendChild(option);
        }
        if (Object.hasOwn(setting?.value || {}, selectedPage)) {
            cmsSeoPage.value = selectedPage;
        }
        const key = cmsSeoPage.value;
        const metadata = setting?.value?.[key];
        cmsSeoIdentity.textContent = setting && metadata
            ? `${key}.html · ${setting.status} · revisione ${setting.updatedAt}`
            : "Metadati SEO non disponibili.";
        cmsSeoTitle.value = metadata?.title || "";
        cmsSeoDescription.value = metadata?.description || "";
        cmsSeoImage.value = metadata?.socialImage || "";
        cmsSeoPublicationStatus.value = setting?.status || "draft";
        cmsSeoSubmit.disabled = !setting || !metadata;
        renderCmsSeoPreview();
    }

    function renderCmsSeoPreview() {
        cmsSeoPreview.replaceChildren();
        const image = document.createElement("img");
        image.src = cmsSeoImage.value;
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        const content = document.createElement("div");
        const title = document.createElement("h4");
        title.textContent = cmsSeoTitle.value || "Title della pagina";
        const description = document.createElement("p");
        description.textContent = cmsSeoDescription.value ||
            "Descrizione mostrata nei risultati e nelle condivisioni.";
        content.append(title, description);
        cmsSeoPreview.append(image, content);
    }

    async function saveCmsSeo(event) {
        event.preventDefault();
        const setting = cmsSeoSetting();
        const key = cmsSeoPage.value;
        if (!setting || !Object.hasOwn(setting.value, key)) return;
        cmsSeoSubmit.disabled = true;
        cmsSeoReload.disabled = true;
        cmsSeoStatus.textContent = "Salvataggio metadati…";
        try {
            const value = structuredClone(setting.value);
            value[key] = {
                title: cmsSeoTitle.value.trim(),
                description: cmsSeoDescription.value.trim(),
                socialImage: cmsSeoImage.value.trim()
            };
            const data = await request(
                "/api/admin/cms/settings/site.metadata.pages",
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        value,
                        status: cmsSeoPublicationStatus.value,
                        expectedUpdatedAt: setting.updatedAt
                    })
                }
            );
            await loadCmsSettings("site.metadata.pages");
            renderCmsSeoForm(key);
            cmsSeoStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Metadati salvati e revisione SEO registrata.";
        } catch (error) {
            cmsSeoStatus.textContent = error.message ||
                "Non è stato possibile salvare i metadati SEO.";
            cmsSeoSubmit.disabled = false;
        } finally {
            cmsSeoReload.disabled = false;
        }
    }

    function selectedCmsLegalDocument() {
        return loadedCmsLegalDocuments.find(
            (document) => document.id === cmsLegalDocumentSelect.value
        );
    }

    function selectedCmsLegalVersion() {
        return selectedCmsLegalDocument()?.versions.find(
            (version) => version.id === cmsLegalVersionSelect.value
        );
    }

    async function loadCmsLegal(preferredDocumentId = "", preferredVersionId = "") {
        const documentId = preferredDocumentId || cmsLegalDocumentSelect.value;
        const versionId = preferredVersionId || cmsLegalVersionSelect.value;
        cmsLegalStatus.textContent = "Caricamento documenti legali…";
        try {
            const data = await request("/api/admin/cms/legal");
            loadedCmsLegalDocuments = data.documents || [];
            cmsLegalDocumentSelect.replaceChildren();
            for (const document of loadedCmsLegalDocuments) {
                const option = window.document.createElement("option");
                option.value = document.id;
                option.textContent = document.title;
                cmsLegalDocumentSelect.appendChild(option);
            }
            if (loadedCmsLegalDocuments.some(
                (document) => document.id === documentId
            )) cmsLegalDocumentSelect.value = documentId;
            renderCmsLegalVersions(versionId);
            cmsLegalStatus.textContent = "";
        } catch (error) {
            cmsLegalStatus.textContent = error.message ||
                "Non è stato possibile caricare i documenti legali.";
        }
    }

    function renderCmsLegalVersions(preferredVersionId = "") {
        const document = selectedCmsLegalDocument();
        cmsLegalVersionSelect.replaceChildren();
        if (!document) {
            renderCmsLegalForm();
            return;
        }
        for (const version of document.versions) {
            const option = window.document.createElement("option");
            option.value = version.id;
            option.textContent = `Versione ${version.number} — ${version.status}`;
            cmsLegalVersionSelect.appendChild(option);
        }
        const defaultVersion = document.versions.find(
            (version) => version.status === "draft"
        ) || document.versions.find(
            (version) => version.number === document.currentVersion
        );
        cmsLegalVersionSelect.value = document.versions.some(
            (version) => version.id === preferredVersionId
        ) ? preferredVersionId : defaultVersion?.id || "";
        renderCmsLegalForm();
    }

    function renderCmsLegalForm() {
        const document = selectedCmsLegalDocument();
        const version = selectedCmsLegalVersion();
        const editable = version?.status === "draft";
        cmsLegalIdentity.textContent = version
            ? `${version.id} · SHA-256 ${version.checksum}`
            : "Nessuna versione disponibile.";
        cmsLegalEffectiveDate.value = version?.effectiveDate || "";
        cmsLegalBody.value = version?.bodyHtml || "";
        cmsLegalEffectiveDate.readOnly = !editable;
        cmsLegalBody.readOnly = !editable;
        cmsLegalSave.disabled = !editable;
        cmsLegalPublish.disabled = !editable;
        cmsLegalNew.disabled = !document || document.versions.some(
            (item) => item.status === "draft"
        );
    }

    async function createCmsLegalVersion() {
        const document = selectedCmsLegalDocument();
        const source = selectedCmsLegalVersion();
        if (!document || !source) return;
        cmsLegalNew.disabled = true;
        try {
            const data = await request(
                `/api/admin/cms/legal/${encodeURIComponent(document.id)}/versions`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        effectiveDate: source.effectiveDate,
                        bodyHtml: source.bodyHtml
                    })
                }
            );
            await loadCmsLegal(document.id, data.version.id);
            cmsLegalStatus.textContent =
                "Nuova bozza creata; modifica data e contenuto prima di pubblicare.";
        } catch (error) {
            cmsLegalStatus.textContent = error.message ||
                "Non è stato possibile creare la nuova versione.";
        } finally {
            renderCmsLegalForm();
        }
    }

    async function saveCmsLegalVersion(event) {
        event.preventDefault();
        const document = selectedCmsLegalDocument();
        const version = selectedCmsLegalVersion();
        if (!document || version?.status !== "draft") return;
        cmsLegalSave.disabled = true;
        try {
            const data = await request(
                `/api/admin/cms/legal/versions/${encodeURIComponent(version.id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        effectiveDate: cmsLegalEffectiveDate.value,
                        bodyHtml: cmsLegalBody.value,
                        expectedChecksum: version.checksum,
                        expectedEffectiveDate: version.effectiveDate
                    })
                }
            );
            await loadCmsLegal(document.id, version.id);
            cmsLegalStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : "Bozza salvata e revisione registrata.";
        } catch (error) {
            cmsLegalStatus.textContent = error.message ||
                "Non è stato possibile salvare la bozza.";
        } finally {
            renderCmsLegalForm();
        }
    }

    async function publishCmsLegalVersion() {
        const document = selectedCmsLegalDocument();
        const version = selectedCmsLegalVersion();
        if (!document || version?.status !== "draft") return;
        if (!window.confirm(
            "Pubblicare questa versione? Dopo la pubblicazione non potrà più essere modificata."
        )) return;
        cmsLegalPublish.disabled = true;
        cmsLegalSave.disabled = true;
        try {
            const data = await request(
                `/api/admin/cms/legal/versions/${encodeURIComponent(version.id)}/publish`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        expectedChecksum: version.checksum,
                        expectedEffectiveDate: version.effectiveDate
                    })
                }
            );
            await loadCmsLegal(document.id, data.version.id);
            cmsLegalStatus.textContent =
                "Versione pubblicata e resa immutabile.";
        } catch (error) {
            cmsLegalStatus.textContent = error.message ||
                "Non è stato possibile pubblicare la versione.";
        } finally {
            renderCmsLegalForm();
        }
    }

    function selectedCmsPermalink() {
        return loadedCmsPermalinks.find(
            (permalink) => permalink.id === cmsPermalinkSelect.value
        );
    }

    async function loadCmsPermalinks(preferredId = "") {
        const selectedId = preferredId || cmsPermalinkSelect.value;
        cmsPermalinkStatus.textContent = "Caricamento permalink…";
        try {
            const data = await request("/api/admin/cms/permalinks");
            loadedCmsPermalinks = data.permalinks || [];
            const newOption = document.createElement("option");
            newOption.value = "";
            newOption.textContent = "Nuovo permalink";
            cmsPermalinkSelect.replaceChildren(newOption);
            for (const permalink of loadedCmsPermalinks) {
                const option = document.createElement("option");
                option.value = permalink.id;
                option.textContent = `${permalink.path} — ${permalink.state}`;
                cmsPermalinkSelect.appendChild(option);
            }
            cmsPermalinkSelect.value = loadedCmsPermalinks.some(
                (permalink) => permalink.id === selectedId
            ) ? selectedId : "";
            renderCmsPermalinkForm();
            cmsPermalinkStatus.textContent = "";
        } catch (error) {
            cmsPermalinkStatus.textContent = error.message ||
                "Non è stato possibile caricare il registro permalink.";
        }
    }

    function renderCmsPermalinkForm() {
        const permalink = selectedCmsPermalink();
        cmsPermalinkIdentity.textContent = permalink
            ? `${permalink.id} · creato ${new Date(permalink.createdAt).toLocaleDateString("it-IT")}`
            : "Il percorso diventerà immutabile appena viene registrato.";
        cmsPermalinkPath.value = permalink?.path || "";
        cmsPermalinkTargetType.value = permalink?.targetType || "";
        cmsPermalinkTargetId.value = permalink?.targetId || "";
        cmsPermalinkState.value = permalink?.state || "active";
        cmsPermalinkRedirect.value = permalink?.redirectPath || "";
        cmsPermalinkPath.readOnly = Boolean(permalink);
        cmsPermalinkTargetType.readOnly = Boolean(permalink);
        cmsPermalinkTargetId.readOnly = Boolean(permalink);
        cmsPermalinkRedirect.disabled = cmsPermalinkState.value !== "redirect";
        cmsPermalinkSubmit.textContent = permalink
            ? "Salva stato permalink"
            : "Crea permalink";
    }

    async function saveCmsPermalink(event) {
        event.preventDefault();
        const permalink = selectedCmsPermalink();
        cmsPermalinkSubmit.disabled = true;
        cmsPermalinkNew.disabled = true;
        cmsPermalinkReload.disabled = true;
        try {
            const body = {
                path: cmsPermalinkPath.value,
                targetType: cmsPermalinkTargetType.value,
                targetId: cmsPermalinkTargetId.value,
                state: cmsPermalinkState.value,
                redirectPath: cmsPermalinkState.value === "redirect"
                    ? cmsPermalinkRedirect.value
                    : null
            };
            if (permalink) body.expectedUpdatedAt = permalink.updatedAt;
            const data = await request(permalink
                ? `/api/admin/cms/permalinks/${encodeURIComponent(permalink.id)}`
                : "/api/admin/cms/permalinks", {
                method: permalink ? "PATCH" : "POST",
                body: JSON.stringify(body)
            });
            await loadCmsPermalinks(data.permalink.id);
            cmsPermalinkStatus.textContent = data.unchanged
                ? "Nessuna modifica da salvare."
                : permalink
                    ? "Stato aggiornato; il percorso è rimasto invariato."
                    : "Permalink registrato con percorso immutabile.";
        } catch (error) {
            cmsPermalinkStatus.textContent = error.message ||
                "Non è stato possibile salvare il permalink.";
        } finally {
            cmsPermalinkSubmit.disabled = false;
            cmsPermalinkNew.disabled = false;
            cmsPermalinkReload.disabled = false;
        }
    }

    function selectedCmsPreview() {
        let entityType = "";
        let entityId = "";
        try {
            [entityType, entityId] = JSON.parse(cmsPreviewSelect.value);
        } catch (_) {}
        return loadedCmsPreviews.find((preview) =>
            preview.entityType === entityType && preview.entityId === entityId
        );
    }

    function cmsPreviewLabel(preview) {
        const snapshot = preview.snapshot || {};
        const title = snapshot.title || snapshot.name || snapshot.label ||
            snapshot.key || preview.entityId;
        return `${preview.entityType} — ${title} — ${preview.state}`;
    }

    async function loadCmsPreviews(preferredValue = "") {
        const selectedValue = preferredValue || cmsPreviewSelect.value;
        cmsPreviewStatus.textContent = "Caricamento anteprime…";
        try {
            const data = await request("/api/admin/cms/preview");
            loadedCmsPreviews = data.previews || [];
            cmsPreviewSelect.replaceChildren();
            for (const preview of loadedCmsPreviews) {
                const option = document.createElement("option");
                option.value = JSON.stringify([
                    preview.entityType,
                    preview.entityId
                ]);
                option.textContent = cmsPreviewLabel(preview);
                cmsPreviewSelect.appendChild(option);
            }
            if (Array.from(cmsPreviewSelect.options).some(
                (option) => option.value === selectedValue
            )) cmsPreviewSelect.value = selectedValue;
            renderCmsPreview();
            await loadCmsRevisions();
            cmsPreviewStatus.textContent = "";
        } catch (error) {
            cmsPreviewStatus.textContent = error.message ||
                "Non è stato possibile caricare l’anteprima.";
        }
    }

    function renderCmsPreview() {
        const preview = selectedCmsPreview();
        cmsPreviewContent.replaceChildren();
        if (!preview) {
            cmsPreviewIdentity.textContent = "Nessuna revisione disponibile.";
            return;
        }
        cmsPreviewIdentity.textContent =
            `${preview.entityType}/${preview.entityId} · revisione ` +
            `${preview.revisionNumber} · ${preview.state}`;
        const snapshot = preview.snapshot || {};

        if (preview.entityType === "site_page") {
            const title = document.createElement("h3");
            title.textContent = snapshot.title || preview.entityId;
            const description = document.createElement("p");
            description.textContent = snapshot.description || "";
            cmsPreviewContent.append(title, description);
            for (const block of snapshot.blocks || []) {
                const paragraph = document.createElement("p");
                paragraph.textContent = block.content?.text || block.text || "";
                cmsPreviewContent.appendChild(paragraph);
            }
            return;
        }

        if (preview.entityType === "poem_work") {
            const title = document.createElement("h3");
            title.textContent = snapshot.title || preview.entityId;
            const subtitle = document.createElement("p");
            subtitle.textContent = snapshot.subtitle || "";
            cmsPreviewContent.append(title, subtitle);
            for (const section of snapshot.sections || []) {
                const heading = document.createElement("h4");
                heading.textContent = section.title || "";
                const verse = document.createElement("p");
                verse.className = "admin-cms-preview-verses";
                verse.textContent = (section.lines || [])
                    .map((line) => line.text || "").join("\n");
                cmsPreviewContent.append(heading, verse);
            }
            return;
        }

        if (preview.entityType === "legal_document_version" && snapshot.bodyHtml) {
            const frame = document.createElement("iframe");
            frame.title = `Anteprima ${preview.entityId}`;
            frame.setAttribute("sandbox", "");
            frame.referrerPolicy = "no-referrer";
            frame.srcdoc = "<meta http-equiv=\"Content-Security-Policy\" " +
                "content=\"default-src 'none'; style-src 'unsafe-inline'\">" +
                snapshot.bodyHtml;
            cmsPreviewContent.appendChild(frame);
            return;
        }

        const data = document.createElement("pre");
        data.textContent = JSON.stringify(snapshot, null, 2);
        cmsPreviewContent.appendChild(data);
    }

    function cmsRevisionLabel(revision) {
        const date = new Date(revision.createdAt).toLocaleString("it-IT");
        return `Revisione ${revision.revisionNumber} — ${revision.state} — ${date}`;
    }

    function selectedCmsRevision(select) {
        const revisionNumber = Number(select.value);
        return loadedCmsRevisions.find(
            (revision) => revision.revisionNumber === revisionNumber
        );
    }

    function renderCmsRevisionComparison() {
        const revisions = [
            selectedCmsRevision(cmsRevisionRestore),
            selectedCmsRevision(cmsRevisionCompare)
        ];
        cmsRevisionComparison.replaceChildren();
        for (const revision of revisions) {
            const article = document.createElement("article");
            if (!revision) {
                article.textContent = "Revisione non disponibile.";
            } else {
                const title = document.createElement("h4");
                title.textContent = cmsRevisionLabel(revision);
                const snapshot = document.createElement("pre");
                snapshot.textContent = JSON.stringify(revision.snapshot, null, 2);
                article.append(title, snapshot);
            }
            cmsRevisionComparison.appendChild(article);
        }
        const restore = revisions[0];
        const latest = loadedCmsRevisions[0];
        cmsRevisionRestoreButton.disabled = !restore || !restore.restorable ||
            restore.revisionNumber === latest?.revisionNumber;
    }

    async function loadCmsRevisions() {
        const preview = selectedCmsPreview();
        loadedCmsRevisions = [];
        cmsRevisionRestore.replaceChildren();
        cmsRevisionCompare.replaceChildren();
        cmsRevisionComparison.replaceChildren();
        cmsRevisionRestoreButton.disabled = true;
        if (!preview) {
            cmsRevisionStatus.textContent = "Nessuna cronologia disponibile.";
            return;
        }
        cmsRevisionStatus.textContent = "Caricamento cronologia…";
        try {
            const query = new URLSearchParams({
                entityType: preview.entityType,
                entityId: preview.entityId
            });
            const data = await request(`/api/admin/cms/revisions?${query}`);
            loadedCmsRevisions = data.revisions || [];
            for (const revision of loadedCmsRevisions) {
                for (const select of [cmsRevisionRestore, cmsRevisionCompare]) {
                    const option = document.createElement("option");
                    option.value = String(revision.revisionNumber);
                    option.textContent = cmsRevisionLabel(revision);
                    select.appendChild(option);
                }
            }
            if (loadedCmsRevisions.length > 1) {
                cmsRevisionRestore.value = String(
                    loadedCmsRevisions[1].revisionNumber
                );
            }
            if (loadedCmsRevisions.length) {
                cmsRevisionCompare.value = String(
                    loadedCmsRevisions[0].revisionNumber
                );
            }
            renderCmsRevisionComparison();
            cmsRevisionStatus.textContent = loadedCmsRevisions[0]?.restorable
                ? ""
                : "Questa cronologia è consultabile ma non ripristinabile.";
        } catch (error) {
            cmsRevisionStatus.textContent = error.message ||
                "Non è stato possibile caricare la cronologia.";
        }
    }

    async function restoreCmsRevision() {
        const preview = selectedCmsPreview();
        const revision = selectedCmsRevision(cmsRevisionRestore);
        if (!preview || !revision || !revision.restorable) return;
        if (!window.confirm(
            `Ripristinare la revisione ${revision.revisionNumber} come nuova modifica?`
        )) return;
        cmsRevisionRestoreButton.disabled = true;
        cmsRevisionReload.disabled = true;
        cmsRevisionStatus.textContent = "Ripristino in corso…";
        const selectedValue = cmsPreviewSelect.value;
        try {
            const path = [
                "/api/admin/cms/revisions",
                encodeURIComponent(preview.entityType),
                encodeURIComponent(preview.entityId),
                revision.revisionNumber,
                "restore"
            ].join("/");
            await request(path, { method: "POST" });
            await Promise.all([
                loadCmsPages(),
                loadCmsPoem(),
                loadCmsNavigation(),
                loadCmsOnboarding(),
                loadCmsMapLayers(),
                loadCmsSources(),
                loadCmsSettings()
            ]);
            await loadCmsPreviews(selectedValue);
            cmsRevisionStatus.textContent =
                "Revisione ripristinata come nuova modifica append-only.";
        } catch (error) {
            cmsRevisionStatus.textContent = error.message ||
                "Non è stato possibile ripristinare la revisione.";
            renderCmsRevisionComparison();
        } finally {
            cmsRevisionReload.disabled = false;
        }
    }

    function showContactListMessage(message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        contactList.replaceChildren(paragraph);
    }

    async function loadContactMessages() {
        showContactListMessage("Caricamento…");

        try {
            const data = await request("/api/admin/contact-messages");
            renderContactMessages(data.messages || []);
        } catch (_) {
            showContactListMessage(
                "I messaggi diretti non sono momentaneamente disponibili."
            );
        }
    }

    function renderContactMessages(messages) {
        contactList.replaceChildren();

        if (!messages.length) {
            showContactListMessage("Nessun messaggio diretto.");
            return;
        }

        messages.forEach((message) => {
            const article = document.createElement("article");
            article.className = "admin-message";

            if (message.status === "unread") {
                article.classList.add("admin-contatto-nuovo");
            }

            const title = document.createElement("h2");
            title.textContent = message.name || "Mittente anonimo";

            const reply = document.createElement("p");
            reply.className = "admin-meta";

            if (message.email) {
                reply.append("Rispondi a: ");

                const address = document.createElement("a");
                address.className = "admin-contatto-email";
                address.href = `mailto:${message.email}`;
                address.textContent = message.email;
                reply.appendChild(address);
            } else {
                reply.textContent = "Nessuna email indicata.";
            }

            const date = document.createElement("p");
            date.className = "admin-meta";
            date.textContent =
                new Date(message.createdAt).toLocaleString("it-IT");

            const text = document.createElement("p");
            text.className = "admin-contact-text";
            appendContactText(text, message.text);

            article.append(title, reply, date, text);

            if (message.status === "unread") {
                const actions = document.createElement("div");
                actions.className = "admin-actions";
                actions.appendChild(contactActionButton(message.id));
                article.appendChild(actions);
            }

            contactList.appendChild(article);
        });
    }

    function appendContactText(container, value) {
        String(value || "").split("\n").forEach((line, index) => {
            if (index > 0) {
                container.appendChild(document.createElement("br"));
            }

            if (line.startsWith("Mappa: https://")) {
                container.append("Mappa: ");

                const link = document.createElement("a");
                link.href = line.slice("Mappa: ".length);
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "apri il punto selezionato";
                container.appendChild(link);
                return;
            }

            container.append(line);
        });
    }

    function contactActionButton(id) {
        const button = document.createElement("button");
        button.className = "admin-action";
        button.type = "button";
        button.textContent = "Segna come letto";

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await request(`/api/admin/contact-messages/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action: "read" })
                });

                await Promise.all([
                    loadContactMessages(),
                    loadSummary()
                ]);
            } catch (_) {
                statusText.textContent =
                    "Non è stato possibile aggiornare il messaggio diretto.";
                button.disabled = false;
            }
        });

        return button;
    }

    function showMemoryListMessage(message) {
        const paragraph = document.createElement("p");
        paragraph.textContent = message;
        memoryList.replaceChildren(paragraph);
    }

    async function loadMemories() {
        showMemoryListMessage("Caricamento…");

        try {
            const data = await request(
                `/api/admin/memories?status=${encodeURIComponent(memoryFilter.value)}`
            );
            renderMemories(data.memories || []);
        } catch (_) {
            showMemoryListMessage(
                "Le memorie non sono momentaneamente disponibili."
            );
        }
    }

    function renderMemories(memories) {
        memoryObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        memoryObjectUrls = [];
        memoryList.replaceChildren();

        if (!memories.length) {
            showMemoryListMessage("Nessuna memoria in questa sezione.");
            return;
        }

        memories.forEach((memory) => {
            const article = document.createElement("article");
            article.className = "admin-message admin-memory";
            const title = document.createElement("h2");
            title.textContent = memory.title;
            const author = document.createElement("p");
            author.className = "admin-meta";
            author.textContent = `Firma: ${memory.authorName || "anonima"}`;
            const state = document.createElement("p");
            state.className = "admin-meta";
            state.textContent = `Stato: ${memory.status}`;
            const date = document.createElement("p");
            date.className = "admin-meta";
            date.textContent = new Date(memory.createdAt).toLocaleString("it-IT");
            const location = document.createElement("p");
            location.className = "admin-meta";
            const locationLink = document.createElement("a");
            locationLink.href =
                `https://www.google.com/maps?q=${memory.lat},${memory.lon}`;
            locationLink.target = "_blank";
            locationLink.rel = "noopener noreferrer";
            locationLink.textContent = "Apri il punto sulla mappa";
            location.appendChild(locationLink);
            const text = document.createElement("p");
            text.className = "admin-contact-text";
            text.textContent = memory.text;

            article.append(title, author, state, date, location, text);

            if (memory.mediaUrl) {
                article.appendChild(memoryMediaButton(memory));
            }

            const actions = document.createElement("div");
            actions.className = "admin-actions";

            if (memory.status !== "approved") {
                actions.appendChild(
                    memoryActionButton(memory.id, "approve", "Approva e pubblica")
                );
            }

            if (memory.status !== "rejected") {
                actions.appendChild(
                    memoryActionButton(
                        memory.id,
                        "reject",
                        memory.status === "approved"
                            ? "Rimuovi dalla mappa"
                            : "Non approvare"
                    )
                );
            }

            article.appendChild(actions);
            memoryList.appendChild(article);
        });
    }

    function memoryMediaButton(memory) {
        const button = document.createElement("button");
        button.className = "admin-action admin-memory-media-button";
        button.type = "button";
        button.textContent = memory.mediaType.startsWith("image/")
            ? "Mostra fotografia"
            : "Carica registrazione";

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                const response = await fetch(`${api.baseUrl}${memory.mediaUrl}`, {
                    headers: {
                        "X-Admin-Token": adminToken,
                        "Accept": memory.mediaType
                    }
                });

                if (!response.ok) {
                    throw new Error("Allegato non disponibile.");
                }

                const objectUrl = URL.createObjectURL(await response.blob());
                memoryObjectUrls.push(objectUrl);
                let media;

                if (memory.mediaType.startsWith("image/")) {
                    media = document.createElement("img");
                    media.alt = `Fotografia associata a «${memory.title}»`;
                } else {
                    media = document.createElement("audio");
                    media.controls = true;
                }

                media.className = "admin-memory-media";
                media.src = objectUrl;
                button.replaceWith(media);
            } catch (_) {
                button.disabled = false;
                button.textContent = "Allegato non disponibile";
            }
        });

        return button;
    }

    function memoryActionButton(id, action, label) {
        const button = document.createElement("button");
        button.className = "admin-action";
        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await request(`/api/admin/memories/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action })
                });
                await Promise.all([loadMemories(), loadSummary()]);
            } catch (_) {
                statusText.textContent =
                    "Non è stato possibile aggiornare la memoria.";
                button.disabled = false;
            }
        });

        return button;
    }

    function render(messages) {
        list.replaceChildren();

        if (!messages.length) {
            showListMessage("Nessun messaggio.");
            return;
        }

        messages.forEach((message) => {
            const article = document.createElement("article");
            article.className = "admin-message";

            const title = document.createElement("h2");
            title.textContent =
                `${message.senderAddress} → ${message.recipientAddress}`;

            const type = document.createElement("p");
            type.className = "admin-meta";
            type.textContent =
                message.deliveryType === "physical"
                    ? "Consegna: lettera fisica"
                    : "Consegna: online";

            const sender = document.createElement("p");
            sender.className = "admin-meta";
            sender.textContent =
                message.revealSender
                    ? "Il destinatario vedrà la location del mittente."
                    : "Il mittente resterà anonimo al destinatario.";

            const archive = document.createElement("p");
            archive.className = "admin-meta admin-archive-meta";
            archive.textContent = archiveStatusText(message);

            const state = document.createElement("p");
            state.className = "admin-meta";
            state.textContent = `Stato: ${message.status}`;

            const date = document.createElement("p");
            date.className = "admin-meta";
            date.textContent =
                new Date(message.createdAt).toLocaleString("it-IT");

            const text = document.createElement("p");
            text.textContent = message.text;

            const actions = document.createElement("div");
            actions.className = "admin-actions";

            if (
                message.deliveryType === "online" &&
                message.status === "pending"
            ) {
                actions.appendChild(
                    actionButton(message.id, "approve", "Approva")
                );
            }

            if (
                message.deliveryType === "physical" &&
                message.status === "pending_delivery"
            ) {
                actions.appendChild(
                    actionButton(message.id, "delivered", "Segna consegnata")
                );
            }

            if (
                ["pending", "pending_delivery"].includes(message.status)
            ) {
                actions.appendChild(
                    actionButton(message.id, "reject", "Rifiuta")
                );
            }

            if (
                message.deliveryType === "online" &&
                ["approved", "read"].includes(message.status) &&
                message.senderPublicConsent &&
                message.recipientPublicConsent &&
                !message.isPublic
            ) {
                actions.appendChild(
                    actionButton(message.id, "publish", "Pubblica nell’archivio")
                );
            }

            if (message.isPublic) {
                actions.appendChild(
                    actionButton(message.id, "unpublish", "Rimuovi dall’archivio")
                );
            }

            article.append(
                title,
                type,
                sender,
                archive,
                state,
                date,
                text,
                actions
            );

            list.appendChild(article);
        });
    }

    function archiveStatusText(message) {
        if (message.deliveryType !== "online") {
            return "Archivio pubblico: non previsto per la consegna fisica.";
        }

        if (message.isPublic) {
            return "Archivio pubblico: pubblicato.";
        }

        if (message.senderPublicConsent && message.recipientPublicConsent) {
            return "Archivio pubblico: entrambi i consensi ricevuti.";
        }

        if (message.senderPublicConsent) {
            return "Archivio pubblico: manca il consenso del destinatario.";
        }

        return "Archivio pubblico: il mittente non ha dato il consenso.";
    }

    function actionButton(id, action, label) {
        const button = document.createElement("button");
        button.className = "admin-action";
        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await request(`/api/admin/messages/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ action })
                });

                await loadMessages();
            } catch (_) {
                statusText.textContent =
                    "Non è stato possibile aggiornare il messaggio.";
            } finally {
                button.disabled = false;
            }
        });

        return button;
    }

    async function downloadExport(format) {
        const button = format === "json" ? exportJson : exportCsv;
        const extension = format === "json" ? "json" : "csv";

        button.disabled = true;
        exportStatus.textContent = "Preparazione dell’esportazione…";

        try {
            const response = await fetch(
                `${api.baseUrl}/api/admin/export?format=${format}`,
                {
                    headers: {
                        "X-Admin-Token": adminToken,
                        "Accept": format === "json"
                            ? "application/json"
                            : "text/csv"
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => null);
                throw new Error(error?.error || "Esportazione non riuscita.");
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);

            link.href = objectUrl;
            link.download = `nnmrcn-messaggi-${date}.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            exportStatus.textContent = "Esportazione completata.";
        } catch (error) {
            exportStatus.textContent =
                error.message || "Non è stato possibile esportare i messaggi.";
        } finally {
            button.disabled = false;
        }
    }

    function ensureMapEntryPicker() {
        const mapContainer = document.getElementById("adminMapEntryMap");

        if (!window.L || !mapContainer) {
            return;
        }

        if (mapEntryMap) {
            refreshMapEntryPickerSize();
            return;
        }

        mapEntryMap = L.map("adminMapEntryMap", {
            scrollWheelZoom: true
        }).setView([45.5515, 12.3278], 13);

        L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
            }
        ).addTo(mapEntryMap);

        mapEntryMap.on("click", (event) => {
            setMapEntryPosition(event.latlng.lat, event.latlng.lng, false);
        });

        if ("ResizeObserver" in window) {
            mapEntryResizeObserver = new ResizeObserver(() => {
                mapEntryMap.invalidateSize({ pan: false });
            });
            mapEntryResizeObserver.observe(mapContainer);
        }

        refreshMapEntryPickerSize();
    }

    function refreshMapEntryPickerSize() {
        if (!mapEntryMap) {
            return;
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                mapEntryMap.invalidateSize({ pan: false });
            });
        });
    }

    function setMapEntryPosition(lat, lon, recenter = true) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        mapEntryLat.value = lat.toFixed(6);
        mapEntryLon.value = lon.toFixed(6);

        if (!mapEntryMap) {
            return;
        }

        if (!mapEntryMarker) {
            mapEntryMarker = L.circleMarker([lat, lon], {
                radius: 9,
                color: "#171717",
                weight: 2,
                fillColor: "#f4f1e8",
                fillOpacity: 0.95
            }).addTo(mapEntryMap);
        } else {
            mapEntryMarker.setLatLng([lat, lon]);
        }

        if (recenter) {
            mapEntryMap.setView([lat, lon], Math.max(mapEntryMap.getZoom(), 15));
        }
    }

    function syncMapEntryPositionFromInputs() {
        setMapEntryPosition(
            Number(mapEntryLat.value),
            Number(mapEntryLon.value),
            true
        );
    }

    async function loadMapEntries() {
        ensureMapEntryPicker();
        mapEntryList.replaceChildren(document.createTextNode("Caricamento…"));

        try {
            const data = await request("/api/admin/map-entries");
            renderMapEntries(data.entries || []);
        } catch (error) {
            mapEntryList.textContent =
                error.message || "Non è stato possibile caricare i luoghi.";
        }
    }

    function renderMapEntries(entries) {
        mapEntryList.replaceChildren();

        if (!entries.length) {
            const message = document.createElement("p");
            message.textContent = "L’elenco è vuoto.";
            mapEntryList.appendChild(message);
            return;
        }

        entries.forEach((entry) => {
            const article = document.createElement("article");
            const title = document.createElement("h3");
            const category = document.createElement("p");
            const description = document.createElement("p");
            const coordinates = document.createElement("p");
            const actions = document.createElement("div");
            const showButton = document.createElement("button");
            const openLink = document.createElement("a");
            const copyButton = document.createElement("button");
            const editButton = document.createElement("button");
            const deleteButton = document.createElement("button");

            article.className = "admin-message admin-map-entry";
            title.textContent = entry.name;
            category.className = "admin-meta";
            category.textContent = mapEntryCategoryLabel(entry.category);
            description.textContent = entry.description || "Nessuna descrizione.";
            coordinates.className = "admin-meta";
            coordinates.textContent = `${entry.lat.toFixed(6)}, ${entry.lon.toFixed(6)}`;
            actions.className = "admin-actions";
            showButton.type = "button";
            showButton.className = "admin-action";
            showButton.textContent = "Mostra nella cartina";
            showButton.addEventListener("click", () => {
                setMapEntryPosition(entry.lat, entry.lon, true);
                document.getElementById("adminMapEntryMap").scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            });

            openLink.className = "admin-action";
            openLink.href = mapEntryQrUrl(entry);
            openLink.target = "_blank";
            openLink.rel = "noopener noreferrer";
            openLink.textContent = "Apri mini-spiegazione";

            copyButton.type = "button";
            copyButton.className = "admin-action";
            copyButton.textContent = "Copia link QR";
            copyButton.addEventListener("click", async () => {
                const originalText = copyButton.textContent;

                copyButton.disabled = true;

                try {
                    await copyText(mapEntryQrUrl(entry));
                    copyButton.textContent = "Link copiato";
                    mapEntryStatus.textContent =
                        `Link per il QR di «${entry.name}» copiato.`;
                } catch (_) {
                    mapEntryStatus.textContent =
                        "Non è stato possibile copiare il link. Aprilo e copialo dalla barra del browser.";
                } finally {
                    window.setTimeout(() => {
                        copyButton.textContent = originalText;
                        copyButton.disabled = false;
                    }, 1600);
                }
            });

            editButton.type = "button";
            editButton.className = "admin-action";
            editButton.textContent = "Modifica o sposta";
            editButton.addEventListener("click", () => {
                startMapEntryEdit(entry);
            });

            deleteButton.type = "button";
            deleteButton.className = "admin-action admin-action-danger";
            deleteButton.textContent = "Elimina";
            deleteButton.addEventListener("click", () => {
                deleteMapEntry(entry, deleteButton);
            });

            actions.append(
                showButton,
                openLink,
                copyButton,
                editButton,
                deleteButton
            );

            article.append(
                title,
                category,
                description,
                coordinates,
                actions
            );
            mapEntryList.appendChild(article);
        });
    }

    function mapEntryQrUrl(entry) {
        const url = new URL("./luogo.html", document.baseURI);

        url.searchParams.set("luogo", String(entry.id));
        return url.href;
    }

    async function copyText(value) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const field = document.createElement("textarea");

        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();

        const copied = document.execCommand("copy");
        field.remove();

        if (!copied) {
            throw new Error("Copia non disponibile.");
        }
    }

    function mapEntryCategoryLabel(category) {
        const labels = {
            luogo: "Luogo",
            edificio: "Edificio",
            monumento: "Monumento",
            infrastruttura: "Infrastruttura",
            paesaggio: "Paesaggio",
            corso_d_acqua: "Corso d’acqua",
            cava: "Cava",
            percorso: "Percorso"
        };

        return labels[category] || "Luogo";
    }

    function mapEntryInput() {
        const value = {
            name: mapEntryName.value,
            category: mapEntryCategory.value,
            description: mapEntryDescription.value,
            lat: Number(mapEntryLat.value),
            lon: Number(mapEntryLon.value),
            sourceUrl: mapEntrySourceUrl.value,
            sourceLabel: mapEntrySourceLabel.value,
            removeImage: mapEntryImageRemoved
        };

        if (mapEntryImage) {
            value.image = {
                name: mapEntryImage.name,
                type: mapEntryImage.type,
                data: mapEntryImage.data,
                variants: mapEntryImage.variants || []
            };
        }

        return value;
    }

    function clearMapEntryImagePreview() {
        if (mapEntryImageObjectUrl) {
            URL.revokeObjectURL(mapEntryImageObjectUrl);
            mapEntryImageObjectUrl = "";
        }

        mapEntryImagePreviewImg.removeAttribute("src");
        mapEntryImagePreview.hidden = true;
    }

    function showMapEntryImagePreview(source) {
        mapEntryImagePreviewImg.src = source;
        mapEntryImagePreview.hidden = false;
    }

    async function selectMapEntryImage() {
        const file = mapEntryImageInput.files?.[0];

        if (!file) {
            return;
        }

        mapEntryImageInput.disabled = true;
        mapEntryStatus.textContent = "Preparazione della fotografia…";

        try {
            const prepared = await prepareMapEntryImage(file);

            clearMapEntryImagePreview();
            mapEntryImage = prepared;
            mapEntryImageRemoved = false;
            mapEntryImageObjectUrl = URL.createObjectURL(prepared.blob);
            showMapEntryImagePreview(mapEntryImageObjectUrl);
            mapEntryStatus.textContent =
                "Fotografia pronta. Salva la voce per pubblicarla.";
        } catch (error) {
            mapEntryStatus.textContent =
                error.message || "Non è stato possibile preparare la fotografia.";
        } finally {
            mapEntryImageInput.value = "";
            mapEntryImageInput.disabled = false;
        }
    }

    async function prepareMapEntryImage(file) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            throw new Error("Formato non supportato. Usa JPEG, PNG o WebP.");
        }

        let original = await resizeMapEntryImage(file, 1800, 0.82);

        if (original.blob.size > 700000) {
            original = await resizeMapEntryImage(file, 1400, 0.7);
        }

        if (original.blob.size > 700000) {
            original = await resizeMapEntryImage(file, 1000, 0.58);
        }

        if (!original.blob.size || original.blob.size > 700000) {
            throw new Error(
                "La fotografia resta troppo grande dopo la riduzione automatica."
            );
        }

        const candidates = await Promise.all([
            responsiveMapEntryVariant(file, "small", 480, 0.72),
            responsiveMapEntryVariant(file, "medium", 960, 0.76)
        ]);
        const variants = candidates.filter((variant, index, all) =>
            variant.width < original.width &&
            all.findIndex((candidate) => candidate.width === variant.width) === index
        );

        return {
            name: file.name || "fotografia",
            type: original.blob.type,
            data: await mapEntryBlobToBase64(original.blob),
            width: original.width,
            height: original.height,
            variants,
            blob: original.blob
        };
    }

    async function resizeMapEntryImage(file, maxDimension, quality) {
        const source = URL.createObjectURL(file);
        const image = new Image();

        try {
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = () => reject(
                    new Error("La fotografia selezionata non è leggibile.")
                );
                image.src = source;
            });
        } finally {
            URL.revokeObjectURL(source);
        }

        const scale = Math.min(
            1,
            maxDimension / Math.max(image.naturalWidth, image.naturalHeight)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { alpha: true });

        if (!context) {
            throw new Error("Il browser non può elaborare questa fotografia.");
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const webpSupported = canvas
            .toDataURL("image/webp", 0.1)
            .startsWith("data:image/webp");
        const outputType = webpSupported ? "image/webp" : "image/jpeg";
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, outputType, quality);
        });

        if (!blob) {
            throw new Error("Non è stato possibile preparare la fotografia.");
        }

        return { blob, width: canvas.width, height: canvas.height };
    }

    async function responsiveMapEntryVariant(file, key, maxDimension, quality) {
        const variant = await resizeMapEntryImage(file, maxDimension, quality);
        return {
            key,
            type: variant.blob.type,
            width: variant.width,
            height: variant.height,
            data: await mapEntryBlobToBase64(variant.blob)
        };
    }

    function mapEntryBlobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const value = String(reader.result || "");
                resolve(value.slice(value.indexOf(",") + 1));
            };
            reader.onerror = () => reject(
                new Error("Non è stato possibile leggere la fotografia.")
            );
            reader.readAsDataURL(blob);
        });
    }

    function resetMapEntryForm() {
        clearMapEntryImagePreview();
        editingMapEntryId = null;
        editingMapEntryHasImage = false;
        mapEntryImage = null;
        mapEntryImageRemoved = false;
        mapEntryForm.reset();
        mapEntryCategory.value = "luogo";
        mapEntryLat.value = "";
        mapEntryLon.value = "";
        mapEntrySubmit.textContent = "Aggiungi alla mappa";
        mapEntryCancel.hidden = true;

        if (mapEntryMarker && mapEntryMap) {
            mapEntryMap.removeLayer(mapEntryMarker);
            mapEntryMarker = null;
        }
    }

    function startMapEntryEdit(entry) {
        clearMapEntryImagePreview();
        editingMapEntryId = entry.id;
        editingMapEntryHasImage = Boolean(entry.imageUrl);
        mapEntryImage = null;
        mapEntryImageRemoved = false;
        mapEntryName.value = entry.name;
        mapEntryCategory.value = entry.category;
        mapEntryDescription.value = entry.description || "";
        mapEntrySourceUrl.value = entry.sourceUrl || "";
        mapEntrySourceLabel.value = entry.sourceLabel || "";

        if (entry.imageUrl) {
            showMapEntryImagePreview(`${api.baseUrl}${entry.imageUrl}`);
        }
        mapEntrySubmit.textContent = "Salva modifiche";
        mapEntryCancel.hidden = false;
        mapEntryStatus.textContent =
            `Modifica di «${entry.name}». Tocca la cartina per spostarla.`;
        setMapEntryPosition(entry.lat, entry.lon, true);
        mapEntryForm.scrollIntoView({ behavior: "smooth", block: "start" });
        refreshMapEntryPickerSize();
        mapEntryName.focus({ preventScroll: true });
    }

    async function saveMapEntry(event) {
        event.preventDefault();

        mapEntrySubmit.disabled = true;
        mapEntryCancel.disabled = true;
        mapEntryStatus.textContent = editingMapEntryId
            ? "Aggiornamento…"
            : "Salvataggio…";

        try {
            const entryId = editingMapEntryId;
            const path = entryId
                ? `/api/admin/map-entries/${entryId}`
                : "/api/admin/map-entries";

            await request(path, {
                method: entryId ? "PATCH" : "POST",
                body: JSON.stringify(mapEntryInput())
            });

            resetMapEntryForm();
            mapEntryStatus.textContent = entryId
                ? "Voce aggiornata. La nuova posizione è già pubblica."
                : "Voce aggiunta. È già visibile nella mappa pubblica.";
            await loadMapEntries();
            mapEntryName.focus();
        } catch (error) {
            mapEntryStatus.textContent =
                error.message || "Non è stato possibile salvare la voce.";
        } finally {
            mapEntrySubmit.disabled = false;
            mapEntryCancel.disabled = false;
        }
    }

    async function deleteMapEntry(entry, button) {
        const confirmed = window.confirm(
            `Eliminare definitivamente «${entry.name}» dalla mappa pubblica?`
        );

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        mapEntryStatus.textContent = `Eliminazione di «${entry.name}»…`;

        try {
            await request(`/api/admin/map-entries/${entry.id}`, {
                method: "DELETE"
            });

            if (editingMapEntryId === entry.id) {
                resetMapEntryForm();
            }

            mapEntryStatus.textContent =
                `«${entry.name}» è stata eliminata dalla mappa pubblica.`;
            await loadMapEntries();
        } catch (error) {
            button.disabled = false;
            mapEntryStatus.textContent =
                error.message || "Non è stato possibile eliminare la voce.";
        }
    }

    function ensureNarrativePicker() {
        const mapContainer = document.getElementById("adminNarrativeMap");

        if (!window.L || !mapContainer) {
            return;
        }

        if (narrativeMap) {
            refreshNarrativePickerSize();
            return;
        }

        narrativeMap = L.map("adminNarrativeMap", {
            scrollWheelZoom: true
        }).setView([45.5515, 12.3278], 13);

        L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
            }
        ).addTo(narrativeMap);

        narrativeMap.on("click", (event) => {
            setNarrativePosition(event.latlng.lat, event.latlng.lng, false);
            narrativeZoom.value = String(narrativeMap.getZoom());
        });

        narrativeMap.on("zoomend", () => {
            narrativeZoom.value = String(narrativeMap.getZoom());
        });

        if ("ResizeObserver" in window) {
            narrativeResizeObserver = new ResizeObserver(() => {
                narrativeMap.invalidateSize({ pan: false });
            });
            narrativeResizeObserver.observe(mapContainer);
        }

        refreshNarrativePickerSize();
    }

    function refreshNarrativePickerSize() {
        if (!narrativeMap) {
            return;
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                narrativeMap.invalidateSize({ pan: false });
            });
        });
    }

    function setNarrativePosition(lat, lon, recenter = true, zoom = null) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return;
        }

        narrativeLat.value = lat.toFixed(6);
        narrativeLon.value = lon.toFixed(6);

        if (!narrativeMap) {
            return;
        }

        if (!narrativeMarker) {
            narrativeMarker = L.circleMarker([lat, lon], {
                radius: 9,
                color: "#171717",
                weight: 2,
                fillColor: "#f4f1e8",
                fillOpacity: 0.95
            }).addTo(narrativeMap);
        } else {
            narrativeMarker.setLatLng([lat, lon]);
        }

        if (recenter) {
            const nextZoom = Number.isFinite(Number(zoom))
                ? Number(zoom)
                : Math.max(narrativeMap.getZoom(), 15);
            narrativeMap.setView([lat, lon], nextZoom);
            narrativeZoom.value = String(nextZoom);
        }
    }

    function syncNarrativePositionFromInputs() {
        setNarrativePosition(
            Number(narrativeLat.value),
            Number(narrativeLon.value),
            true,
            Number(narrativeZoom.value)
        );
    }

    async function loadNarrativeSteps() {
        ensureNarrativePicker();
        narrativeList.replaceChildren(document.createTextNode("Caricamento…"));

        try {
            const data = await request("/api/admin/narrative-steps");
            loadedNarrativeSteps = data.steps || [];
            renderNarrativeSteps(loadedNarrativeSteps);

            if (!editingNarrativeId) {
                narrativePosition.value = String(nextNarrativePosition());
            }
        } catch (error) {
            narrativeList.textContent =
                error.message || "Non è stato possibile caricare il percorso.";
        }
    }

    function nextNarrativePosition() {
        return loadedNarrativeSteps.reduce(
            (maximum, step) => Math.max(maximum, Number(step.position) || 0),
            0
        ) + 1;
    }

    function renderNarrativeSteps(steps) {
        narrativeList.replaceChildren();

        if (!steps.length) {
            const message = document.createElement("p");
            message.textContent = "Il percorso non contiene tappe.";
            narrativeList.appendChild(message);
            return;
        }

        steps.forEach((step) => {
            const article = document.createElement("article");
            const title = document.createElement("h3");
            const verse = document.createElement("p");
            const description = document.createElement("p");
            const meta = document.createElement("p");
            const actions = document.createElement("div");
            const showButton = document.createElement("button");
            const editButton = document.createElement("button");
            const deleteButton = document.createElement("button");

            article.className = "admin-message admin-map-entry";
            if (!step.published) {
                article.classList.add("admin-narrative-draft");
            }

            title.textContent = `${step.position}. ${step.title}`;
            verse.className = "admin-meta";
            verse.textContent = step.verse;
            description.textContent = step.text;
            meta.className = "admin-meta";
            meta.textContent = step.published
                ? `${step.label} · pubblicata`
                : `${step.label} · bozza non visibile`;
            actions.className = "admin-actions";

            showButton.type = "button";
            showButton.className = "admin-action";
            showButton.textContent = "Mostra nella cartina";
            showButton.addEventListener("click", () => {
                setNarrativePosition(
                    Number(step.lat),
                    Number(step.lon),
                    true,
                    Number(step.zoom)
                );
                document.getElementById("adminNarrativeMap").scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            });

            editButton.type = "button";
            editButton.className = "admin-action";
            editButton.textContent = "Modifica";
            editButton.addEventListener("click", () => {
                startNarrativeEdit(step);
            });

            deleteButton.type = "button";
            deleteButton.className = "admin-action admin-action-danger";
            deleteButton.textContent = "Elimina";
            deleteButton.addEventListener("click", () => {
                deleteNarrativeStep(step, deleteButton);
            });

            actions.append(showButton, editButton, deleteButton);
            article.append(title, verse, description, meta, actions);
            narrativeList.appendChild(article);
        });
    }

    function narrativeSourcesInput(sources) {
        return (sources || []).map((source) =>
            `${(source.terms || []).join("; ")} | ${source.url}`
        ).join("\n");
    }

    function parseNarrativeSources(value) {
        return String(value || "")
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => {
                const separator = line.lastIndexOf("|");

                if (separator < 1) {
                    throw new Error(
                        `Fonte ${index + 1}: usa il formato termini | indirizzo.`
                    );
                }

                const terms = line.slice(0, separator)
                    .split(";")
                    .map((term) => term.trim())
                    .filter(Boolean);
                const url = line.slice(separator + 1).trim();

                if (!terms.length || !url) {
                    throw new Error(
                        `Fonte ${index + 1}: termini e indirizzo sono obbligatori.`
                    );
                }

                return { terms, url };
            });
    }

    function narrativeInput() {
        return {
            position: Number(narrativePosition.value),
            verse: narrativeVerse.value,
            label: narrativeLabel.value,
            title: narrativeTitle.value,
            titleUrl: narrativeTitleUrl.value,
            text: narrativeText.value,
            sources: parseNarrativeSources(narrativeSources.value),
            lat: Number(narrativeLat.value),
            lon: Number(narrativeLon.value),
            zoom: Number(narrativeZoom.value),
            published: narrativePublished.checked
        };
    }

    function resetNarrativeForm() {
        editingNarrativeId = null;
        narrativeForm.reset();
        narrativePosition.value = String(nextNarrativePosition());
        narrativeZoom.value = "16";
        narrativePublished.checked = true;
        narrativeSubmit.textContent = "Aggiungi tappa";
        narrativeCancel.hidden = true;

        if (narrativeMarker && narrativeMap) {
            narrativeMap.removeLayer(narrativeMarker);
            narrativeMarker = null;
        }
    }

    function startNarrativeEdit(step) {
        editingNarrativeId = Number(step.id);
        narrativePosition.value = String(step.position);
        narrativeVerse.value = step.verse;
        narrativeLabel.value = step.label;
        narrativeTitle.value = step.title;
        narrativeTitleUrl.value = step.titleUrl || "";
        narrativeText.value = step.text;
        narrativeSources.value = narrativeSourcesInput(step.sources);
        narrativeZoom.value = String(step.zoom);
        narrativePublished.checked = Boolean(step.published);
        narrativeSubmit.textContent = "Salva modifiche";
        narrativeCancel.hidden = false;
        narrativeStatus.textContent = `Modifica di «${step.title}».`;
        setNarrativePosition(
            Number(step.lat),
            Number(step.lon),
            true,
            Number(step.zoom)
        );
        narrativeForm.scrollIntoView({ behavior: "smooth", block: "start" });
        refreshNarrativePickerSize();
        narrativeVerse.focus({ preventScroll: true });
    }

    async function saveNarrativeStep(event) {
        event.preventDefault();
        narrativeSubmit.disabled = true;
        narrativeCancel.disabled = true;
        narrativeStatus.textContent = editingNarrativeId
            ? "Aggiornamento…"
            : "Salvataggio…";

        try {
            const stepId = editingNarrativeId;
            const path = stepId
                ? `/api/admin/narrative-steps/${stepId}`
                : "/api/admin/narrative-steps";

            await request(path, {
                method: stepId ? "PATCH" : "POST",
                body: JSON.stringify(narrativeInput())
            });

            resetNarrativeForm();
            narrativeStatus.textContent = stepId
                ? "Tappa aggiornata. Il percorso pubblico usa già la nuova versione."
                : "Tappa aggiunta al percorso.";
            await loadNarrativeSteps();
            narrativeVerse.focus();
        } catch (error) {
            narrativeStatus.textContent =
                error.message || "Non è stato possibile salvare la tappa.";
        } finally {
            narrativeSubmit.disabled = false;
            narrativeCancel.disabled = false;
        }
    }

    async function deleteNarrativeStep(step, button) {
        const confirmed = window.confirm(step.everPublished
            ? `Ritirare «${step.title}» dal percorso pubblico? La tappa resterà modificabile e potrà essere ripubblicata.`
            : `Eliminare definitivamente la bozza «${step.title}»?`);

        if (!confirmed) {
            return;
        }

        button.disabled = true;
        narrativeStatus.textContent = step.everPublished
            ? `Ritiro di «${step.title}»…`
            : `Eliminazione di «${step.title}»…`;

        try {
            await request(`/api/admin/narrative-steps/${step.id}`, {
                method: "DELETE"
            });

            if (editingNarrativeId === Number(step.id)) {
                resetNarrativeForm();
            }

            narrativeStatus.textContent = step.everPublished
                ? `«${step.title}» è stata ritirata e conservata come bozza.`
                : `La bozza «${step.title}» è stata eliminata.`;
            await loadNarrativeSteps();
        } catch (error) {
            button.disabled = false;
            narrativeStatus.textContent =
                error.message || "Non è stato possibile eliminare la tappa.";
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        adminToken = tokenInput.value.trim();

        if (!adminToken) {
            return;
        }

        sessionStorage.setItem(TOKEN_KEY, adminToken);
        tokenInput.value = "";
        await loadMessages();
    });

    refresh.addEventListener("click", loadMessages);
    filter.addEventListener("change", loadMessages);
    memoryRefresh.addEventListener("click", loadMemories);
    memoryFilter.addEventListener("change", loadMemories);
    search.addEventListener("input", renderCurrentMessages);
    exportCsv.addEventListener("click", () => downloadExport("csv"));
    exportJson.addEventListener("click", () => downloadExport("json"));
    mapEntryForm.addEventListener("submit", saveMapEntry);
    mapEntryCancel.addEventListener("click", () => {
        resetMapEntryForm();
        mapEntryStatus.textContent = "Modifica annullata.";
        mapEntryName.focus();
    });
    mapEntryLat.addEventListener("change", syncMapEntryPositionFromInputs);
    mapEntryLon.addEventListener("change", syncMapEntryPositionFromInputs);
    mapEntryImageInput.addEventListener("change", selectMapEntryImage);
    mapEntryImageRemove.addEventListener("click", () => {
        clearMapEntryImagePreview();
        mapEntryImage = null;
        mapEntryImageRemoved = editingMapEntryHasImage;
        mapEntryStatus.textContent = editingMapEntryHasImage
            ? "La fotografia verrà rimossa quando salvi la voce."
            : "Fotografia rimossa dalla selezione.";
    });
    narrativeForm.addEventListener("submit", saveNarrativeStep);
    cmsPageForm.addEventListener("submit", saveCmsPage);
    cmsPageSelect.addEventListener("change", renderCmsPageForm);
    cmsPageReload.addEventListener("click", () => {
        const page = selectedCmsPage();
        loadCmsPages(page?.id || "");
    });
    cmsPoemForm.addEventListener("submit", saveCmsPoem);
    cmsPoemReload.addEventListener("click", loadCmsPoem);
    cmsNavigationForm.addEventListener("submit", saveCmsNavigation);
    cmsNavigationReload.addEventListener("click", loadCmsNavigation);
    cmsOnboardingForm.addEventListener("submit", saveCmsOnboarding);
    cmsOnboardingReload.addEventListener("click", loadCmsOnboarding);
    cmsMapLayerForm.addEventListener("submit", saveCmsMapLayer);
    cmsMapLayerSelect.addEventListener("change", () => {
        renderCmsMapLayerForm();
        if (!selectedCmsMapFeature()) {
            renderCmsMapFeatureForm();
        }
    });
    cmsMapLayerReload.addEventListener("click", () => {
        loadCmsMapLayers(cmsMapLayerSelect.value, cmsMapFeatureSelect.value);
    });
    cmsMapFeatureForm.addEventListener("submit", saveCmsMapFeature);
    cmsMapFeatureSelect.addEventListener("change", renderCmsMapFeatureForm);
    cmsMapFeatureLayer.addEventListener("change", () => {
        if (!selectedCmsMapFeature()) {
            cmsMapFeaturePosition.value = String(
                nextCmsMapFeaturePosition(cmsMapFeatureLayer.value)
            );
        }
    });
    cmsMapFeatureReset.addEventListener("click", () => {
        cmsMapFeatureSelect.value = "";
        renderCmsMapFeatureForm();
        cmsMapFeatureStatus.textContent = "Nuova geometria pronta.";
        cmsMapFeatureTitle.focus();
    });
    cmsMapFeatureReload.addEventListener("click", () => {
        loadCmsMapLayers(cmsMapLayerSelect.value, cmsMapFeatureSelect.value);
    });
    cmsSourceForm.addEventListener("submit", saveCmsSource);
    cmsSourceSelect.addEventListener("change", renderCmsSourceForm);
    cmsSourceReset.addEventListener("click", () => {
        cmsSourceSelect.value = "";
        renderCmsSourceForm();
        cmsSourceStatus.textContent = "Nuova fonte pronta.";
        cmsSourceTitle.focus();
    });
    cmsSourceReload.addEventListener("click", () => {
        loadCmsSources(cmsSourceSelect.value);
    });
    cmsSettingForm.addEventListener("submit", saveCmsSetting);
    cmsSettingSelect.addEventListener("change", renderCmsSettingForm);
    cmsSettingReload.addEventListener("click", () => {
        loadCmsSettings(cmsSettingSelect.value);
    });
    cmsSeoForm.addEventListener("submit", saveCmsSeo);
    cmsSeoPage.addEventListener("change", () => {
        renderCmsSeoForm(cmsSeoPage.value);
    });
    for (const input of [cmsSeoTitle, cmsSeoDescription, cmsSeoImage]) {
        input.addEventListener("input", renderCmsSeoPreview);
    }
    cmsSeoReload.addEventListener("click", () => {
        loadCmsSettings("site.metadata.pages");
    });
    cmsLegalForm.addEventListener("submit", saveCmsLegalVersion);
    cmsLegalDocumentSelect.addEventListener("change", () => {
        renderCmsLegalVersions();
    });
    cmsLegalVersionSelect.addEventListener("change", renderCmsLegalForm);
    cmsLegalNew.addEventListener("click", createCmsLegalVersion);
    cmsLegalPublish.addEventListener("click", publishCmsLegalVersion);
    cmsLegalReload.addEventListener("click", () => {
        loadCmsLegal(
            cmsLegalDocumentSelect.value,
            cmsLegalVersionSelect.value
        );
    });
    cmsPermalinkForm.addEventListener("submit", saveCmsPermalink);
    cmsPermalinkSelect.addEventListener("change", renderCmsPermalinkForm);
    cmsPermalinkState.addEventListener("change", () => {
        cmsPermalinkRedirect.disabled = cmsPermalinkState.value !== "redirect";
    });
    cmsPermalinkNew.addEventListener("click", () => {
        cmsPermalinkSelect.value = "";
        renderCmsPermalinkForm();
        cmsPermalinkStatus.textContent = "Nuovo permalink pronto.";
        cmsPermalinkPath.focus();
    });
    cmsPermalinkReload.addEventListener("click", () => {
        loadCmsPermalinks(cmsPermalinkSelect.value);
    });
    cmsPreviewSelect.addEventListener("change", () => {
        renderCmsPreview();
        loadCmsRevisions();
    });
    cmsPreviewReload.addEventListener("click", () => {
        loadCmsPreviews(cmsPreviewSelect.value);
    });
    cmsRevisionRestore.addEventListener("change", renderCmsRevisionComparison);
    cmsRevisionCompare.addEventListener("change", renderCmsRevisionComparison);
    cmsRevisionRestoreButton.addEventListener("click", restoreCmsRevision);
    cmsRevisionReload.addEventListener("click", loadCmsRevisions);
    narrativeCancel.addEventListener("click", () => {
        resetNarrativeForm();
        narrativeStatus.textContent = "Modifica annullata.";
        narrativeVerse.focus();
    });
    narrativeLat.addEventListener("change", syncNarrativePositionFromInputs);
    narrativeLon.addEventListener("change", syncNarrativePositionFromInputs);
    narrativeZoom.addEventListener("change", syncNarrativePositionFromInputs);
    welcomePreview.addEventListener("click", () => {
        window.NNMRCN_SESSION.showWelcome(
            () => Promise.resolve(),
            { preview: true }
        );
    });

    document.querySelectorAll("[data-admin-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            filter.value = button.dataset.adminFilter;
            loadMessages();
        });
    });

    document.querySelectorAll("[data-admin-memory-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            memoryFilter.value = button.dataset.adminMemoryFilter;
            loadMemories();
            memorySection.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    if (adminToken) {
        loadMessages();
    } else if (!api.baseUrl) {
        statusText.textContent =
            "Backend non ancora collegato in config.js.";
    }
})();
