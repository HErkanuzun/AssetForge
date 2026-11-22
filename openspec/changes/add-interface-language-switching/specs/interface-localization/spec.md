# Spec Delta

## Purpose

使 AssetForge 用户能在设置中选择英语、简体中文或土耳其语，并在全部应用界面与交互反馈中获得一致的语言体验，同时保护已有项目数据和用户内容，避免切换语言改变业务行为。

## ADDED Requirements

### Requirement: Discoverable language selection
Settings SHALL include a searchable interface-language category using existing navigation styling. Its right-hand panel SHALL offer English, 简体中文, and Türkçe in a labelled selector; the navigation SHALL NOT contain a standalone selector. Successful saves SHALL update mounted interface text immediately while preserving edits, navigation and jobs. Failed saves SHALL retain the prior locale and show a localized error.

#### Scenario: Switch while editing
- **WHEN** the owner selects 简体中文 while a project has pending edits and a running job
- **THEN** navigation, Settings, open panels, tooltips and subsequent feedback display Simplified Chinese immediately after the save succeeds
- **AND** pending edits, selected items, active page and jobs are preserved

#### Scenario: Language remains discoverable
- **WHEN** the owner selects the interface-language category, directly or through a matching localized search
- **THEN** the category uses the existing selected-item styling and the right-hand panel shows all self-named language options
- **AND** clearing a search matching no categories restores access to the language category, including when API keys are missing

#### Scenario: Failed save
- **WHEN** persisting a language selection fails
- **THEN** the previous language remains active and the application displays a translated failure explanation

### Requirement: Persistent and validated locale
The application SHALL persist valid locale choices across restarts and project changes. Without a valid saved choice, it SHALL select Simplified Chinese for a Simplified Chinese system locale, Turkish for a Turkish system locale, and English otherwise. Unsupported submitted locale values SHALL be rejected without corrupting settings.

#### Scenario: Restart with a saved choice
- **WHEN** the user chooses English and restarts on a Chinese-language system
- **THEN** the interface opens in English without briefly displaying Turkish controls

#### Scenario: Upgrade from legacy settings
- **WHEN** settings lack a language or contain an unsupported saved language
- **THEN** startup resolves a supported language from the system locale with English as the fallback
- **AND** existing keys, paths, provider configurations and project settings are retained

#### Scenario: Invalid update
- **WHEN** a client submits an unsupported interface language
- **THEN** the update fails with a localized application explanation and the previous valid settings remain intact

### Requirement: Complete application interface coverage
Every application-owned visible or accessible interface string SHALL have English, Simplified Chinese and Turkish representations. This includes every page and settings subpanel, headings, tables, menus, buttons, dialogs, dropdowns, tabs, empty/loading states, placeholders, help, tooltips, accessibility text, default sample actions, template metadata and third-party canvas controls. Brand names and technical identifiers SHALL remain recognizable.

#### Scenario: Exercise all pages
- **WHEN** the user visits every route and opens its lists, details, filters, menus and dialogs in either English or Simplified Chinese
- **THEN** all application-owned interface text uses the selected language, including disabled controls and empty, loading, success and failure states

#### Scenario: Metadata-driven controls
- **WHEN** the user opens a pipeline node parameter selector or an animation-system template gallery
- **THEN** labels, help, built-in template descriptions and options use the selected language
- **AND** node IDs, option values, port IDs and execution parameters remain unchanged

### Requirement: Localized interaction feedback
Application-owned validation, confirmation, toast, job progress, QA summaries and error explanations SHALL use the active interface language, including messages originating in main/shared modules. Dynamic values SHALL be interpolated as data. External tool/provider output SHALL be preserved as details with a localized explanation when displayed as an application error.

#### Scenario: Asynchronous feedback after switching
- **WHEN** a job started in English fails after switching to Simplified Chinese
- **THEN** the application's failure label and explanation use Simplified Chinese and retain the resource name and external error detail

#### Scenario: Pending toast or confirmation
- **WHEN** the language changes with an application-owned toast or custom dialog already visible
- **THEN** its application text updates and its dynamic values remain intact

### Requirement: Native and browser surfaces
Application-owned native dialog captions, file-filter descriptions, tray menus and Windows jump-list labels SHALL follow the saved locale. Browser-rendered application, login, invitation and authentication feedback SHALL follow the host locale. Read-only and editor permissions SHALL remain unchanged; language updates SHALL propagate to connected application views.

#### Scenario: Desktop language change
- **WHEN** the owner changes the language and opens the tray menu, jump list or project-folder dialog
- **THEN** application-owned labels use the newly selected language
- **AND** operating-system-owned labels remain controlled by the operating system

#### Scenario: Browser access
- **WHEN** a browser opens login or invitation pages on a Simplified Chinese host
- **THEN** application-owned form labels, role descriptions and authentication errors appear in Simplified Chinese
- **AND** translated content is escaped and existing authentication and authorization rules are preserved

#### Scenario: Shared session receives locale update
- **WHEN** the owner changes the language with an editor and viewer connected
- **THEN** their open application views update to the host language without granting either client settings-write permission

### Requirement: Locale-aware formatting and search
Application-owned date, relative-time, number, count and plural formatting SHALL follow the active locale. Settings search SHALL match translated categories, descriptions and keywords. Document language and font fallback SHALL support the selected locale, including readable Simplified Chinese without clipped essential controls.

#### Scenario: Formatted content
- **WHEN** English or Simplified Chinese is active and the user views job dates, triangle counts, asset ages and queue counts
- **THEN** localized formatting and grammatically appropriate count messages appear
- **AND** settings search in that language finds the corresponding category

### Requirement: Preserve project and execution semantics
Changing interface language SHALL NOT translate or mutate user-entered names, descriptions, imported content, saved chats, generated text, raw logs, paths, API parameters, prompts or internal identifiers. Known application status values and unchanged built-in metadata SHALL be translated at display time; user-customized labels SHALL be preserved.

#### Scenario: Existing Turkish project
- **WHEN** an existing Turkish project with custom names, statuses and pipeline templates is viewed in Simplified Chinese and then English
- **THEN** known application status labels and unchanged built-in template labels are localized
- **AND** project values, custom names, saved chat history and node semantics remain unchanged

### Requirement: Translation completeness and fallback
Supported language catalogs SHALL cover the same application message keys and interpolation parameters. Missing translations at runtime SHALL fall back to English rather than raw keys or Turkish in English/Chinese views. Release verification SHALL detect missing keys, interpolation mismatches and unclassified hardcoded user-facing text.

#### Scenario: Catalog regression
- **WHEN** a message translation or required interpolation parameter is removed from a supported catalog
- **THEN** automated validation reports the offending key and language

#### Scenario: Unexpected missing translation
- **WHEN** a translated message is unexpectedly unavailable at runtime
- **THEN** the user sees the English message with its dynamic values rather than a raw translation key
