# Ittijah validation run

| Project | Commit | Files | Time | Findings | By rule | Parse errors |
|---|---|---:|---:|---:|---|---:|
| excalidraw | 701b901 | 898 | 2125 ms | 151 | no-physical-properties: 129<br>missing-dir-attribute: 11<br>bidi-unsafe-string: 11 | 0 |
| cal.com | 2eb48ec | 2601 | 2174 ms | 490 | no-physical-properties: 486<br>missing-dir-attribute: 3<br>directional-icons: 1 | 0 |
| jitsi-meet | ab58977 | 2442 | 1414 ms | 90 | no-physical-properties: 83<br>missing-dir-attribute: 7 | 1 |
| element-web | f0211b9 | 2711 | 2731 ms | 496 | no-physical-properties: 480<br>missing-dir-attribute: 7<br>bidi-unsafe-string: 9 | 2 |
| chatwoot | 625d596 | 4098 | 936 ms | 21 | bidi-unsafe-string: 10<br>no-physical-properties: 11 | 0 |

## Sample for manual review (30)

### 1. cal.com — `apps/web/modules/event-types/components/tabs/advanced/FormBuilder.tsx:301` — no-physical-properties

"-ml-4" is a physical utility: it does not flip in RTL. Use "-ms-4".

```
    299 |                       <button
    300 |                         type="button"
>   301 |                         className="bg-default text-muted hover:text-emphasis disabled:hover:text-muted border-subtle hover:border-emphasis invisible absolute -left-[12px] -ml-4 -mt-4 mb-4 hidden h-6 w-6 scale-0 items-cen…
    302 |                         onClick={() => swap(index, index - 1)}>
    303 |                         <ArrowUpIcon className="h-5 w-5" />
```

Verdict: TP

### 2. excalidraw — `packages/excalidraw/locales/ku-TR.json:441` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: exportDialog.excalidrawplus_description)

```
    439 |     "link_details": "ناردن وەک بەستەری تەنها-خوێندنەوە.",
    440 |     "link_button": "هەناردەکردن بۆ بەستەر",
>   441 |     "excalidrawplus_description": "دیمەنەکە لە شوێنی کارکردنی Excalidraw+ هەڵبگرە.",
    442 |     "excalidrawplus_button": "هەناردەکردن",
    443 |     "excalidrawplus_exportError": "لەم ساتەدا نەتوانرا هەناردە بکرێت بۆ Excalidrow+..."
```

Verdict: TP

### 3. excalidraw — `excalidraw-app/components/TopErrorBoundary.tsx:133` — missing-dir-attribute

<textarea> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    131 |               <div className="ErrorSplash-details">
    132 |                 <label>{t("errorSplash.sceneContent")}</label>
>   133 |                 <textarea
    134 |                   rows={5}
    135 |                   onPointerDown={this.selectTextArea}
```

Verdict: TP

### 4. cal.com — `apps/web/modules/webhooks/views/webhook-form-header.tsx:38` — directional-icons

"ArrowLeftIcon" points the same way in both directions. In RTL layouts "next/forward" points left and "back" points right, so this icon points backwards for Arabic/Hebrew readers. To fix it, add "rtl:-scale-x-100" to its className, or swap the icon based on the document direction.

```
     36 |             size="icon-sm"
     37 |             variant="ghost">
>    38 |             <ArrowLeftIcon />
     39 |           </Button>
     40 |         )}
```

Verdict: TP

### 5. element-web — `apps/web/res/css/views/rooms/_AppsDrawer.pcss:70` — no-physical-properties

"left" is physical: in RTL it stays on the left. Use "inset-inline-start".

```
     68 |         .mx_ResizeHandle--horizontal::before {
     69 |             position: absolute;
>    70 |             left: 3px;
     71 |             top: 50%;
     72 |             transform: translate(0, -50%);
```

Verdict: **FP** — grip centered in a thin handle

### 6. excalidraw — `packages/excalidraw/locales/ar-SA.json:599` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: welcomeScreen.app.center_heading_plus)

```
    597 |       "center_heading_line2": "يُمكن محُ تخزين المتصفح بشكل غير متوقع.",
    598 |       "center_heading_line3": "احفظ عملك في ملف بانتظام لتجنب فقدانه.",
>   599 |       "center_heading_plus": "هل تريد الانتقال إلى Excalidraw+ بدلاً من ذلك؟",
    600 |       "menuHint": "التصدير، التفضيلات، اللغات..."
    601 |     },
```

Verdict: TP

### 7. jitsi-meet — `react/features/welcome/components/WelcomePage.web.tsx:235` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    233 |                                 <div className = 'enter-room-input-container'>
    234 |                                     <form onSubmit = { this._onFormSubmit }>
>   235 |                                         <input
    236 |                                             aria-disabled = 'false'
    237 |                                             aria-label = { t('welcomepage.accessibilityLabel.roomname') }
```

Verdict: TP

### 8. jitsi-meet — `css/_popover.scss:27` — no-physical-properties

"left" is physical: in RTL it stays on the left. Use "inset-inline-start".

```
     25 | 
     26 |             &.right {
>    27 |                 left: 4px;
     28 |             }
     29 |         }
```

Verdict: **FP** — physical placement class .right

### 9. element-web — `apps/web/src/i18n/strings/fa.json:894` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "@bot:*" renders as "bot:*@". "@" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "@", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs_mjolnir.explainer_1)

```
    892 |         "error_removing_list_description": "لطفا مجددا اقدام کرده و برای کسب اطلاعات بیشتر کنسول مرورگر خود را مشاهده نمائید.",
    893 |         "error_removing_list_title": "لغو اشتراک از لیست با خطا همراه بود",
>   894 |         "explainer_1": "کاربران و سرورهایی که قصد نادیده گرفتن آن‌ها را دارید در این‌جا اضافه کنید. در %(brand)s از ستاره (*) برای مچ‌شدن با هر کاراکتری استفاده کنید. برای مثال، <code>@bot:*</code> همه‌ی کاربران یا سروره…
    895 |         "explainer_2": "نادیده‌گرفتن افراد توسط لیست تحریم صورت می‌گیرد که حاوی قوانینی برای تشخیص این است که چه کسی را تحریم کند. اضافه‌شدن به لیست تحریم به این معناست که کاربر/سرور بلاک شده و از دید شما پنهان خواهد بود…
    896 |         "lists": "شما هم‌اکنون مشترک شده‌اید در:",
```

Verdict: TP — latent: element-web never renders RTL

### 10. excalidraw — `examples/with-script-in-browser/components/ExampleApp.tsx:607` — missing-dir-attribute

<textarea> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    605 | 
    606 |     return (
>   607 |       <textarea
    608 |         className="comment"
    609 |         style={{
```

Verdict: TP

### 11. cal.com — `packages/ui/components/editor/stylesEditor.css:268` — no-physical-properties

"margin-right" is physical: in RTL it stays on the right. Use "margin-inline-end".

```
    266 |   height: 20px;
    267 |   user-select: none;
>   268 |   margin-right: 12px;
    269 |   line-height: 16px;
    270 |   background-size: contain;
```

Verdict: TP

### 12. element-web — `apps/web/src/i18n/strings/fa.json:905` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "@bot:*" renders as "bot:*@". "@" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "@", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs_mjolnir.personal_new_placeholder)

```
    903 |         "personal_heading": "لیست تحریم شخصی",
    904 |         "personal_new_label": "شناسه‌ی سرور یا کاربر مورد نظر برای نادیده‌گرفتن",
>   905 |         "personal_new_placeholder": "برای مثال: @bot:* یا example.org",
    906 |         "personal_section": "شما در حال حاضر این موارد را نادیده گرفته‌اید:",
    907 |         "room_name": "لیست تحریم‌های من",
```

Verdict: TP — latent

### 13. element-web — `apps/web/src/components/views/polls/PollOption.tsx:28` — missing-dir-attribute

<div> renders user-generated content (answer.text) without dir="auto". A message written in the other direction inherits the page direction: it is aligned to the wrong edge and its punctuation jumps ("Thanks!" → "!Thanks"). Add dir="auto" (or wrap it in <bdi>).

```
     26 |     return (
     27 |         <div className="mx_PollOption_content">
>    28 |             <div className="mx_PollOption_optionText">{answer.text}</div>
     29 |             <div className="mx_PollOption_optionVoteCount">
     30 |                 {isWinner && <TrophyIcon className="mx_PollOption_winnerIcon" />}
```

Verdict: TP

### 14. jitsi-meet — `css/_chrome-extension-banner.scss:9` — no-physical-properties

"float: right" is physical: in RTL it stays right. Use "float: inline-end".

```
      7 |   border-radius: 4px;
      8 |   z-index: 1000;
>     9 |   float: right;
     10 |   display: flex;
     11 |   flex-direction: column;
```

Verdict: TP

### 15. excalidraw — `packages/excalidraw/locales/fa-IR.json:636` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and the end of an RTL paragraph, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: overwriteConfirm.action.excalidrawPlus.description)

```
    634 |         "title": "Excalidraw+",
    635 |         "button": "خروجی به Excalidraw+",
>   636 |         "description": "ذخیره صفحه در میز کار Excalidraw+."
    637 |       }
    638 |     },
```

Verdict: TP

### 16. jitsi-meet — `resources/waiting-queue/examples/visitor.html:2` — missing-dir-attribute

<html> has no lang attribute. Screen readers pick the wrong voice for Arabic/Hebrew, and browsers pick the wrong fonts and hyphenation. Add lang (and dir for RTL languages).

```
      1 | <!DOCTYPE html>
>     2 | <html>
      3 | <head>
      4 |     <title>Conference WebSocket</title>
```

Verdict: TP

### 17. element-web — `apps/web/res/css/views/dialogs/_DevtoolsDialog.pcss:61` — no-physical-properties

"float: left" is physical: in RTL it stays left. Use "float: inline-start".

```
     59 | 
     60 | .mx_DevTools_label_left {
>    61 |     float: left;
     62 | }
     63 | 
```

Verdict: TP — latent

### 18. excalidraw — `packages/excalidraw/locales/he-IL.json:599` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: welcomeScreen.app.center_heading_plus)

```
    597 |       "center_heading_line2": "זיכרון הדפדפן יכול להתנקות באופן לא צפוי.",
    598 |       "center_heading_line3": "כדאי לשמור את העבודה שלך תדיר בתור קובץ בשביל שהיא לא תיאבד.",
>   599 |       "center_heading_plus": "אתה רוצה ללכת אל Excalidraw+ במקום?",
    600 |       "menuHint": "ייצוא, העדפות, שפות, ..."
    601 |     },
```

Verdict: TP

### 19. cal.com — `apps/web/app/global-error.tsx:15` — missing-dir-attribute

<html> has no lang attribute. Screen readers pick the wrong voice for Arabic/Hebrew, and browsers pick the wrong fonts and hyphenation. Add lang (and dir for RTL languages).

```
     13 |   }, [props.error]);
     14 |   return (
>    15 |     <html>
     16 |       <body>
     17 |         <CustomError {...props} />
```

Verdict: TP

### 20. excalidraw — `packages/excalidraw/components/ElementLinkDialog.scss:7` — no-physical-properties

"left" is physical: in RTL it stays on the left. Use "inset-inline-start".

```
      5 |     position: absolute;
      6 |     top: var(--editor-container-padding);
>     7 |     left: var(--editor-container-padding);
      8 | 
      9 |     z-index: var(--zIndex-modal);
```

Verdict: TP

### 21. excalidraw — `packages/excalidraw/locales/ar-SA.json:635` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and the end of an RTL paragraph, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: overwriteConfirm.action.excalidrawPlus.button)

```
    633 |       "excalidrawPlus": {
    634 |         "title": "Excalidraw+",
>   635 |         "button": "تصدير إلى Excalidraw+",
    636 |         "description": "حفظ المشهد إلى مساحة العمل +Excalidraw الخاصة بك."
    637 |       }
```

Verdict: TP

### 22. jitsi-meet — `resources/waiting-queue/examples/visitor.html:23` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
     21 |                     <button id="connect" class="btn btn-default" type="submit">Connect</button>
     22 |                     <label for="conference">What is your conference?</label>
>    23 |                     <input type="text" id="conference" class="form-control" placeholder="Your conference here...">
     24 |                     <button id="disconnect" class="btn btn-default" type="submit" disabled="disabled">Disconnect
     25 |                     </button>
```

Verdict: TP

### 23. element-web — `apps/web/res/css/structures/_TabbedView.pcss:139` — no-physical-properties

"margin-right" is physical: in RTL it stays on the right. Use "margin-inline-end".

```
    137 |             justify-content: center;
    138 |             svg {
>   139 |                 margin-right: 0;
    140 |             }
    141 |         }
```

Verdict: TP — latent

### 24. excalidraw — `packages/excalidraw/locales/ku-TR.json:599` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and the end of an RTL paragraph, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: welcomeScreen.app.center_heading_plus)

```
    597 |       "center_heading_line2": "",
    598 |       "center_heading_line3": "",
>   599 |       "center_heading_plus": "ویستت بڕۆیت بۆ Excalidraw+?",
    600 |       "menuHint": "هەناردەکردن، ڕێکخستنەکان، زمانەکان، ..."
    601 |     },
```

Verdict: TP

### 25. excalidraw — `packages/excalidraw/components/ImageExportDialog.tsx:206` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    204 |         <div className="ImageExportModal__preview__filename">
    205 |           {!nativeFileSystemSupported && (
>   206 |             <input
    207 |               type="text"
    208 |               className="TextInput"
```

Verdict: TP

### 26. jitsi-meet — `css/filmstrip/_vertical_filmstrip_overrides.scss:9` — no-physical-properties

"text-align: left" is physical: in RTL it stays left. Use "text-align: start".

```
      7 | .vertical-filmstrip #sharedvideo,
      8 | .stage-filmstrip #sharedvideo {
>     9 |     text-align: left;
     10 | }
     11 | 
```

Verdict: TP

### 27. element-web — `apps/web/src/i18n/strings/he.json:944` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "@bot:" renders as "bot:@". "@" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "@", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs_mjolnir.personal_new_placeholder)

```
    942 |         "personal_heading": "רשימת חסומים פרטית",
    943 |         "personal_new_label": "שרת או משתמש להתעלם ממנו",
>   944 |         "personal_new_placeholder": "למשל: @bot: * או example.org",
    945 |         "personal_section": "אתם כרגע מתעלמים מ:",
    946 |         "room_name": "רשימת החסומים שלי",
```

Verdict: TP — latent

### 28. excalidraw — `packages/excalidraw/components/PublishLibrary.tsx:479` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    477 |                 </span>
    478 |               </div>
>   479 |               <input
    480 |                 type="text"
    481 |                 name="authorName"
```

Verdict: TP

### 29. cal.com — `packages/ui/components/editor/stylesEditor.css:3` — no-physical-properties

"padding-left" is physical: in RTL it stays on the left. Use "padding-inline-start".

```
      1 | 
      2 | .editor li {
>     3 |   padding-left: 1.28571429em;
      4 |   text-indent: -1.28571429em;
      5 | }
```

Verdict: TP

### 30. chatwoot — `app/javascript/dashboard/i18n/locale/fa/contact.json:110` — bidi-unsafe-string [signed-number]

[signed-number] "+98415555555" renders as "98415555555+" in RTL text. The "+" is not attached to the number by the bidi algorithm (it is only joined to digits on both sides), so it resolves to the surrounding RTL direction and is drawn on the far side; the digit groups are reordered right-to-left as well. Wrap the number in LRI (U+2066) … PDI (U+2069) or put U+200E LEFT-TO-RIGHT MARK before "+". (key: CONTACT_FORM.FORM.PHONE_NUMBER.HELP)

```
    108 |         "PLACEHOLDER": "شماره تلفن مخاطب را وارد کنید",
    109 |         "LABEL": "شماره تلفن",
>   110 |         "HELP": "شماره تلفن باید با فرمت E.164 باشد به عنوان مثال: +98415555555 [+] [کد کشور] [کد منطقه] [شماره تلفن محلی]",
    111 |         "ERROR": "شماره تلفن باید یا خالی باشد و یا با فرمت E.164",
    112 |         "DIAL_CODE_ERROR": "لطفاً یک کد شماره گیری را از لیست انتخاب کنید",
```

Verdict: TP

