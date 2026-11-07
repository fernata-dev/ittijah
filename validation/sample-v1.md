# Ittijah validation run

| Project | Commit | Files | Time | Findings | By rule | Parse errors |
|---|---|---:|---:|---:|---|---:|
| excalidraw | 701b901 | 898 | 1707 ms | 167 | no-physical-properties: 129<br>missing-dir-attribute: 15<br>bidi-unsafe-string: 23 | 0 |
| cal.com | 2eb48ec | 2601 | 1841 ms | 494 | no-physical-properties: 486<br>missing-dir-attribute: 7<br>directional-icons: 1 | 0 |
| jitsi-meet | ab58977 | 2442 | 1254 ms | 175 | no-physical-properties: 83<br>missing-dir-attribute: 9<br>bidi-unsafe-string: 83 | 1 |
| element-web | f0211b9 | 2711 | 3022 ms | 819 | no-physical-properties: 480<br>missing-dir-attribute: 9<br>bidi-unsafe-string: 330 | 2 |
| chatwoot | 625d596 | 4098 | 871 ms | 445 | bidi-unsafe-string: 434<br>no-physical-properties: 11 | 0 |

## Sample for manual review (30)

### 1. cal.com — `apps/web/modules/event-types/components/tabs/advanced/RequiresConfirmationController.tsx:201` — no-physical-properties

"border-r-0" is a physical utility: it does not flip in RTL. Use "border-e-0".

```
    199 |                                       }}
    200 |                                       className={classNames(
>   201 |                                     "m-0! block w-16 rounded-r-none border-default border-r-0 text-sm [appearance:textfield] focus:z-10 focus:border-r",
    202 |                                         customClassNames?.conditionalConfirmationRadio?.timeInput
    203 |                                       )}
```

Verdict: _TBD_

### 2. jitsi-meet — `lang/main-he.json:417` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder {{component}} before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: notify.focusFail)

```
    415 |         "disconnected": "מנותק",
    416 |         "focus": "התמקדות בכנס",
>   417 |         "focusFail": "{{component}} לא זמין - נסה שוב בעוד {{ms}} שניות",
    418 |         "invitedOneMember": "{{name}} הוזמן",
    419 |         "invitedThreePlusMembers": "{{name}}ו- {{count}} אחרים הוזמנו",
```

Verdict: _TBD_

### 3. element-web — `apps/web/src/components/views/polls/pollHistory/PollListItem.tsx:40` — missing-dir-attribute

<span> renders user-generated content (pollEvent.question.text) without dir="auto". A message written in the other direction inherits the page direction: it is aligned to the wrong edge and its punctuation jumps ("Thanks!" → "!Thanks"). Add dir="auto" (or wrap it in <bdi>).

```
     38 |                     <span>{formattedDate}</span>
     39 |                     <PollsIcon className="mx_PollListItem_icon" />
>    40 |                     <span className="mx_PollListItem_question">{pollEvent.question.text}</span>
     41 |                 </div>
     42 |             </AccessibleButton>
```

Verdict: _TBD_

### 4. cal.com — `apps/web/modules/webhooks/views/webhook-form-header.tsx:38` — directional-icons

"ArrowLeftIcon" points the same way in both directions. In RTL layouts "next/forward" points left and "back" points right, so this icon points backwards for Arabic/Hebrew readers. To fix it, add "rtl:-scale-x-100" to its className, or swap the icon based on the document direction.

```
     36 |             size="icon-sm"
     37 |             variant="ghost">
>    38 |             <ArrowLeftIcon />
     39 |           </Button>
     40 |         )}
```

Verdict: _TBD_

### 5. cal.com — `apps/web/modules/apps/components/AdminAppsList.tsx:348` — no-physical-properties

"pr-10" is a physical utility: it does not flip in RTL. Use "pe-10".

```
    346 | const SkeletonLoader = () => {
    347 |   return (
>   348 |     <SkeletonContainer className="w-120 pr-10">
    349 |       <div className="mb-8 mt-6 stack-y-6">
    350 |         <SkeletonText className="h-8 w-full" />
```

Verdict: _TBD_

### 6. element-web — `apps/web/src/i18n/strings/fa.json:1824` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(senderName)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.m.room.third_party_invite.revoked)

```
   1822 |         },
   1823 |         "m.room.third_party_invite": {
>  1824 |             "revoked": "%(senderName)s دعوت نامه %(targetDisplayName)s را برای پیوستن به اتاق باطل کرد.",
   1825 |             "sent": "%(senderName)s %(targetDisplayName)s را به اتاق دعوت کرد."
   1826 |         },
```

Verdict: _TBD_

### 7. cal.com — `packages/ui/components/form/select/Select.tsx:212` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    210 |       />
    211 |       {required && (
>   212 |         <input
    213 |           tabIndex={-1}
    214 |           autoComplete="off"
```

Verdict: _TBD_

### 8. cal.com — `apps/web/modules/onboarding/components/onboarding-migrate-members-browser-view.tsx:112` — no-physical-properties

"left-4" is a physical utility: it does not flip in RTL. Use "start-4".

```
    110 |                 {/* Organization Logo - Overlaying the banner */}
    111 |                 {organizationLogo && (
>   112 |                   <div className="absolute -bottom-8 left-4">
    113 |                     <Avatar
    114 |                       size="lg"
```

Verdict: _TBD_

### 9. element-web — `apps/web/src/i18n/strings/he.json:1885` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(senderName)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.m.call.invite.voice_call)

```
   1883 |             "video_call": "%(senderName)s התחיל שיחת וידאו.",
   1884 |             "video_call_unsupported": "%(senderName)s התחיל שיחת וידאו. (אינו נתמך בדפדפן זה)",
>  1885 |             "voice_call": "%(senderName)s התחיל שיחה קולית.",
   1886 |             "voice_call_unsupported": "%(senderName)s התחיל שיחה קולית. (אינו נתמך בדפדפן זה)"
   1887 |         },
```

Verdict: _TBD_

### 10. jitsi-meet — `react/features/speaker-stats/components/web/SpeakerStatsSearch.tsx:108` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    106 |                 color = { theme.palette.speakerStatsSearchIcon }
    107 |                 src = { IconSearch } />
>   108 |             <input
    109 |                 aria-describedby = { inputDescriptionId }
    110 |                 aria-label = { t('speakerStats.searchHint') }
```

Verdict: _TBD_

### 11. excalidraw — `packages/excalidraw/components/ProjectName.scss:11` — no-physical-properties

"margin-left" is physical: in RTL it stays on the left. Use "margin-inline-start".

```
      9 |     overflow: hidden;
     10 |     text-align: center;
>    11 |     margin-left: 8px;
     12 |     text-overflow: ellipsis;
     13 | 
```

Verdict: _TBD_

### 12. element-web — `apps/web/src/i18n/strings/fa.json:1767` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(senderDisplayName)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.m.room.guest_access.can_join)

```
   1765 |         },
   1766 |         "m.room.guest_access": {
>  1767 |             "can_join": "%(senderDisplayName)s به مهمانان اجازه عضویت در اتاق را داد.",
   1768 |             "forbidden": "%(senderDisplayName)s از پیوستن مهمان به اتاق جلوگیری کرد.",
   1769 |             "unknown": "%(senderDisplayName)s دسترسی مهمانان را به %(rule)s تغییر داد"
```

Verdict: _TBD_

### 13. jitsi-meet — `resources/waiting-queue/examples/visitor.html:2` — missing-dir-attribute

<html> has no lang attribute. Screen readers pick the wrong voice for Arabic/Hebrew, and browsers pick the wrong fonts and hyphenation. Add lang (and dir for RTL languages).

```
      1 | <!DOCTYPE html>
>     2 | <html>
      3 | <head>
      4 |     <title>Conference WebSocket</title>
```

Verdict: _TBD_

### 14. element-web — `apps/web/res/css/components/views/location/_ZoomButtons.pcss:12` — no-physical-properties

"right" is physical: in RTL it stays on the right. Use "inset-inline-end".

```
     10 |     position: absolute;
     11 |     bottom: var(--cpd-space-8x);
>    12 |     right: var(--cpd-space-6x);
     13 |     display: flex;
     14 |     flex-direction: column;
```

Verdict: _TBD_

### 15. chatwoot — `app/javascript/dashboard/i18n/locale/ur_IN/integrations.json:297` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with Latin text "AI" before any RTL letter. wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: INTEGRATION_SETTINGS.OPEN_AI.SUMMARY_TITLE)

```
    295 |       },
    296 |       "TITLE": "AI کے ساتھ بہتری",
>   297 |       "SUMMARY_TITLE": "AI کے ساتھ خلاصہ",
    298 |       "REPLY_TITLE": "AI کے ساتھ جواب کی تجویز",
    299 |       "SUBTITLE": "آپ کے موجودہ مسودے کی بنیاد پر AI کے ذریعے بہتر جواب تیار کیا جائے گا۔",
```

Verdict: _TBD_

### 16. cal.com — `apps/web/modules/onboarding/personal/settings/personal-settings-view.tsx:205` — missing-dir-attribute

<p> renders user-generated content (form.formState.errors.bio.message) without dir="auto". A message written in the other direction inherits the page direction: it is aligned to the wrong edge and its punctuation jumps ("Thanks!" → "!Thanks"). Add dir="auto" (or wrap it in <bdi>).

```
    203 |                 <TextArea {...form.register("bio")} className="min-h-[108px] max-h-[150px]" />
    204 |                 {form.formState.errors.bio && (
>   205 |                   <p className="text-error text-sm">{form.formState.errors.bio.message}</p>
    206 |                 )}
    207 |               </div>
```

Verdict: _TBD_

### 17. element-web — `apps/web/res/css/views/dialogs/_AddExistingToSpaceDialog.pcss:183` — no-physical-properties

"right" is physical: in RTL it stays on the right. Use "inset-inline-end".

```
    181 |                 width: 20px;
    182 |                 height: 20px;
>   183 |                 right: 0;
    184 |                 position: absolute;
    185 |                 color: $accent;
```

Verdict: _TBD_

### 18. element-web — `apps/web/src/i18n/strings/fa.json:967` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(name)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: notifier.m.key.verification.request)

```
    965 |     },
    966 |     "notifier": {
>   967 |         "m.key.verification.request": "%(name)s درخواست تائید دارد"
    968 |     },
    969 |     "onboarding": {
```

Verdict: _TBD_

### 19. excalidraw — `packages/excalidraw/components/TTDDialog/TTDDialogInput.tsx:117` — missing-dir-attribute

<textarea> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    115 |   if (editorState.type === "fallback") {
    116 |     return (
>   117 |       <textarea
    118 |         className="ttd-dialog-input"
    119 |         onChange={(e) => onChange(e.target.value)}
```

Verdict: _TBD_

### 20. cal.com — `apps/web/modules/event-types/views/event-types-listing-view.tsx:227` — no-physical-properties

"ml-3" is a physical utility: it does not flip in RTL. Use "ms-3".

```
    225 |         <div className="absolute h-full w-0.5" style={{ backgroundColor: eventTypeColor }} />
    226 |       )}
>   227 |       <div className={classNames(eventTypeColor && "ml-3")}>
    228 |         {readOnly ? (
    229 |           <div>
```

Verdict: _TBD_

### 21. element-web — `apps/web/src/i18n/strings/fa.json:1756` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(senderName)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.m.room.canonical_alias.changed)

```
   1754 |                 "other": "%(senderName)s آدرس های جایگزین %(addresses)s این اتاق را حذف کرد."
   1755 |             },
>  1756 |             "changed": "%(senderName)s آدرس های این اتاق را تغییر داد.",
   1757 |             "changed_alternative": "%(senderName)s آدرس های جایگزین این اتاق را تغییر داد.",
   1758 |             "changed_main_and_alternative": "%(senderName)s آدرس اصلی و جایگزین این اتاق را تغییر داد.",
```

Verdict: _TBD_

### 22. element-web — `apps/web/src/components/views/polls/PollOption.tsx:28` — missing-dir-attribute

<div> renders user-generated content (answer.text) without dir="auto". A message written in the other direction inherits the page direction: it is aligned to the wrong edge and its punctuation jumps ("Thanks!" → "!Thanks"). Add dir="auto" (or wrap it in <bdi>).

```
     26 |     return (
     27 |         <div className="mx_PollOption_content">
>    28 |             <div className="mx_PollOption_optionText">{answer.text}</div>
     29 |             <div className="mx_PollOption_optionVoteCount">
     30 |                 {isWinner && <TrophyIcon className="mx_PollOption_winnerIcon" />}
```

Verdict: _TBD_

### 23. cal.com — `apps/web/modules/event-types/components/locations/Locations.tsx:289` — no-physical-properties

"ml-6" is a physical utility: it does not flip in RTL. Use "ms-6".

```
    287 |                       name={eventLocationType.defaultValueVariable}
    288 |                       className={classNames(
>   289 |                         "text-error my-1 ml-6 text-sm",
    290 |                         customClassNames?.organizerContactInput?.errorMessage
    291 |                       )}
```

Verdict: _TBD_

### 24. element-web — `apps/web/src/i18n/strings/fa.json:1750` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(senderName)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.m.room.canonical_alias.alt_added.other)

```
   1748 |             "alt_added": {
   1749 |                 "one": "%(senderName)s آدرس جایگزین %(addresses)s را برای این اتاق اضافه کرد.",
>  1750 |                 "other": "%(senderName)s آدرس های جایگزین %(addresses)s را برای این اتاق اضافه کرد."
   1751 |             },
   1752 |             "alt_removed": {
```

Verdict: _TBD_

### 25. jitsi-meet — `react/features/salesforce/components/web/SalesforceLinkDialog.tsx:127` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    125 |                 color = { theme.palette.icon03 }
    126 |                 src = { IconSearch } />
>   127 |             <input
    128 |                 autoComplete = 'off'
    129 |                 autoFocus = { true }
```

Verdict: _TBD_

### 26. cal.com — `apps/web/modules/bookings/components/AvailableTimesHeader.tsx:57` — no-physical-properties

"ml-2" is a physical utility: it does not flip in RTL. Use "ms-2".

```
     55 |         <span
     56 |           className={classNames(
>    57 |             isColumnView && isToday && "bg-brand-default text-brand ml-2",
     58 |             "inline-flex items-center justify-center rounded-3xl px-1 pt-0.5 font-medium",
     59 |             isMonthView
```

Verdict: _TBD_

### 27. element-web — `apps/web/src/i18n/strings/he.json:2014` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(senderName)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.mjolnir.removed_rule_rooms)

```
   2012 |             "created_rule_users": "%(senderName)s יצר כלל החוסם משתמשים התואמים ל%(glob)s עבור %(reason)s",
   2013 |             "removed_rule": "%(senderName)s הסיר כלל חסימה התואם ל%(glob)s",
>  2014 |             "removed_rule_rooms": "%(senderName)s הסיר את הכלל שחוסם חדרים התואמים ל%(glob)s",
   2015 |             "removed_rule_servers": "%(senderName)s הסיר את הכלל החוסם שרתים התואמים ל%(glob)s",
   2016 |             "removed_rule_users": "%(senderName)s הסיר את הכלל שחוסם משתמשים התואמים ל %(glob)s",
```

Verdict: _TBD_

### 28. excalidraw — `packages/excalidraw/components/PublishLibrary.tsx:196` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    194 |             </span>
    195 |           </div>
>   196 |           <input
    197 |             type="text"
    198 |             ref={inputRef}
```

Verdict: _TBD_

### 29. element-web — `apps/web/res/css/views/dialogs/_TermsDialog.pcss:22` — no-physical-properties

"text-align: left" is physical: in RTL it stays left. Use "text-align: start".

```
     20 | .mx_TermsDialog_termsTableHeader {
     21 |     font-weight: bold;
>    22 |     text-align: left;
     23 | }
     24 | 
```

Verdict: _TBD_

### 30. element-web — `apps/web/src/i18n/strings/he.json:2053` — bidi-unsafe-string [leading-ltr]

[leading-ltr] This Arabic/Hebrew string starts with the placeholder %(oneUser)s before any RTL letter. If its value is Latin (names, e-mails, product names…), wherever direction is detected from the first strong character — dir="auto", <title>, push notifications, e-mail subjects, Android/iOS default text direction — the whole string is laid out left-to-right: the RTL words come out in reversed order and trailing punctuation lands on the wrong side. Start the string with U+200F RIGHT-TO-LEFT MARK, or wrap the leading part in FSI (U+2068) … PDI (U+2069). (key: timeline.summary.hidden_event.one)

```
   2051 |             "format": "%(nameList)s-%(transitionList)s",
   2052 |             "hidden_event": {
>  2053 |                 "one": "%(oneUser)sשלח הודעה חבויה",
   2054 |                 "other": "%(oneUser)sשלח%(count)sהודעות מוחבאות"
   2055 |             },
```

Verdict: _TBD_

