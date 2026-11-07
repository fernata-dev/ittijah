# Ittijah validation run

| Project | Commit | Files | Time | Findings | By rule | Parse errors |
|---|---|---:|---:|---:|---|---:|
| excalidraw | 701b901 | 898 | 1708 ms | 150 | no-physical-properties: 129<br>missing-dir-attribute: 10<br>bidi-unsafe-string: 11 | 0 |
| cal.com | 2eb48ec | 2601 | 1744 ms | 490 | no-physical-properties: 486<br>missing-dir-attribute: 3<br>directional-icons: 1 | 0 |
| jitsi-meet | ab58977 | 2442 | 1132 ms | 89 | no-physical-properties: 83<br>missing-dir-attribute: 6 | 1 |
| element-web | f0211b9 | 2711 | 2177 ms | 494 | no-physical-properties: 480<br>missing-dir-attribute: 5<br>bidi-unsafe-string: 9 | 2 |
| chatwoot | 625d596 | 4098 | 874 ms | 21 | bidi-unsafe-string: 10<br>no-physical-properties: 11 | 0 |

## Sample for manual review (30)

### 1. element-web — `apps/web/res/css/views/rooms/_AppsDrawer.pcss:133` — no-physical-properties

"border-right-width" is physical: in RTL it stays on the right. Use "border-inline-end-width".

```
    131 |     }
    132 |     .mx_AppTile:last-of-type {
>   133 |         border-right-width: var(--container-border-width);
    134 |         border-radius: 0 10px 10px 0;
    135 |     }
```

Verdict: _TBD_

### 2. excalidraw — `packages/excalidraw/locales/ku-TR.json:443` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidrow+" renders as "+Excalidrow". "+" sits between a Latin word and the end of an RTL paragraph, so it takes the RTL direction and is drawn on the wrong side of "Excalidrow". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: exportDialog.excalidrawplus_exportError)

```
    441 |     "excalidrawplus_description": "دیمەنەکە لە شوێنی کارکردنی Excalidraw+ هەڵبگرە.",
    442 |     "excalidrawplus_button": "هەناردەکردن",
>   443 |     "excalidrawplus_exportError": "لەم ساتەدا نەتوانرا هەناردە بکرێت بۆ Excalidrow+..."
    444 |   },
    445 |   "helpDialog": {
```

Verdict: _TBD_

### 3. excalidraw — `excalidraw-app/components/TopErrorBoundary.tsx:133` — missing-dir-attribute

<textarea> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    131 |               <div className="ErrorSplash-details">
    132 |                 <label>{t("errorSplash.sceneContent")}</label>
>   133 |                 <textarea
    134 |                   rows={5}
    135 |                   onPointerDown={this.selectTextArea}
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

### 5. cal.com — `apps/web/modules/event-types/components/tabs/advanced/FormBuilder.tsx:301` — no-physical-properties

"sm:ml-0" is a physical utility: it does not flip in RTL. Use "sm:ms-0".

```
    299 |                       <button
    300 |                         type="button"
>   301 |                         className="bg-default text-muted hover:text-emphasis disabled:hover:text-muted border-subtle hover:border-emphasis invisible absolute -left-[12px] -ml-4 -mt-4 mb-4 hidden h-6 w-6 scale-0 items-cen…
    302 |                         onClick={() => swap(index, index - 1)}>
    303 |                         <ArrowUpIcon className="h-5 w-5" />
```

Verdict: _TBD_

### 6. excalidraw — `packages/excalidraw/locales/ar-SA.json:635` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and the end of an RTL paragraph, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: overwriteConfirm.action.excalidrawPlus.button)

```
    633 |       "excalidrawPlus": {
    634 |         "title": "Excalidraw+",
>   635 |         "button": "تصدير إلى Excalidraw+",
    636 |         "description": "حفظ المشهد إلى مساحة العمل +Excalidraw الخاصة بك."
    637 |       }
```

Verdict: _TBD_

### 7. excalidraw — `examples/with-script-in-browser/components/ExampleApp.tsx:607` — missing-dir-attribute

<textarea> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    605 | 
    606 |     return (
>   607 |       <textarea
    608 |         className="comment"
    609 |         style={{
```

Verdict: _TBD_

### 8. excalidraw — `packages/excalidraw/components/ElementLinkDialog.scss:7` — no-physical-properties

"left" is physical: in RTL it stays on the left. Use "inset-inline-start".

```
      5 |     position: absolute;
      6 |     top: var(--editor-container-padding);
>     7 |     left: var(--editor-container-padding);
      8 | 
      9 |     z-index: var(--zIndex-modal);
```

Verdict: _TBD_

### 9. excalidraw — `packages/excalidraw/locales/he-IL.json:599` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: welcomeScreen.app.center_heading_plus)

```
    597 |       "center_heading_line2": "זיכרון הדפדפן יכול להתנקות באופן לא צפוי.",
    598 |       "center_heading_line3": "כדאי לשמור את העבודה שלך תדיר בתור קובץ בשביל שהיא לא תיאבד.",
>   599 |       "center_heading_plus": "אתה רוצה ללכת אל Excalidraw+ במקום?",
    600 |       "menuHint": "ייצוא, העדפות, שפות, ..."
    601 |     },
```

Verdict: _TBD_

### 10. jitsi-meet — `resources/waiting-queue/examples/visitor.html:23` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
     21 |                     <button id="connect" class="btn btn-default" type="submit">Connect</button>
     22 |                     <label for="conference">What is your conference?</label>
>    23 |                     <input type="text" id="conference" class="form-control" placeholder="Your conference here...">
     24 |                     <button id="disconnect" class="btn btn-default" type="submit" disabled="disabled">Disconnect
     25 |                     </button>
```

Verdict: _TBD_

### 11. cal.com — `apps/web/modules/onboarding/components/onboarding-migrate-members-browser-view.tsx:63` — no-physical-properties

"rounded-l-2xl" is a physical utility: it does not flip in RTL. Use "rounded-s-2xl".

```
     61 | 
     62 |   return (
>    63 |     <div className="hidden h-full w-full flex-col overflow-hidden rounded-l-2xl border-subtle border-y border-s bg-default xl:flex">
     64 |       {/* Browser header */}
     65 |       <div className="flex min-w-0 shrink-0 items-center gap-3 rounded-t-2xl border-subtle border-b bg-default p-3">
```

Verdict: _TBD_

### 12. excalidraw — `packages/excalidraw/locales/ku-TR.json:441` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: exportDialog.excalidrawplus_description)

```
    439 |     "link_details": "ناردن وەک بەستەری تەنها-خوێندنەوە.",
    440 |     "link_button": "هەناردەکردن بۆ بەستەر",
>   441 |     "excalidrawplus_description": "دیمەنەکە لە شوێنی کارکردنی Excalidraw+ هەڵبگرە.",
    442 |     "excalidrawplus_button": "هەناردەکردن",
    443 |     "excalidrawplus_exportError": "لەم ساتەدا نەتوانرا هەناردە بکرێت بۆ Excalidrow+..."
```

Verdict: _TBD_

### 13. jitsi-meet — `doc/examples/api.html:1` — missing-dir-attribute

<html> has no lang attribute. Screen readers pick the wrong voice for Arabic/Hebrew, and browsers pick the wrong fonts and hyphenation. Add lang (and dir for RTL languages).

```
>     1 | <html itemscope itemtype="http://schema.org/Product" prefix="og: http://ogp.me/ns#" xmlns="http://www.w3.org/1999/html">
      2 |     <head>
      3 |         <meta charset="utf-8">
```

Verdict: _TBD_

### 14. cal.com — `apps/web/components/ui/UsernameAvailability/PremiumTextfield.tsx:311` — no-physical-properties

"ml-1" is a physical utility: it does not flip in RTL. Use "ms-1".

```
    309 |                 href={paymentLink}>
    310 |                 <>
>   311 |                   {t("go_to_stripe_billing")} <ExternalLinkIcon className="ml-1 h-4 w-4" />
    312 |                 </>
    313 |               </Button>
```

Verdict: _TBD_

### 15. excalidraw — `packages/excalidraw/locales/fa-IR.json:441` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: exportDialog.excalidrawplus_description)

```
    439 |     "link_details": "خروجی به عنوان یک پیوند فقط خواندنی.",
    440 |     "link_button": "خروجی در فایل",
>   441 |     "excalidrawplus_description": "صحنه را در فضای کاری Excalidraw+ خود ذخیره کنید.",
    442 |     "excalidrawplus_button": "خروجی گرفتن",
    443 |     "excalidrawplus_exportError": "در حال حاضر نمی‌توان به Excalidraw+ صادر کرد..."
```

Verdict: _TBD_

### 16. element-web — `apps/web/src/components/views/polls/pollHistory/PollListItemEnded.tsx:105` — missing-dir-attribute

<span> renders user-generated content (pollEvent.question.text) without dir="auto". A message written in the other direction inherits the page direction: it is aligned to the wrong edge and its punctuation jumps ("Thanks!" → "!Thanks"). Add dir="auto" (or wrap it in <bdi>).

```
    103 |                 <div className="mx_PollListItemEnded_title">
    104 |                     <PollsEndIcon className="mx_PollListItemEnded_icon" />
>   105 |                     <span className="mx_PollListItemEnded_question">{pollEvent.question.text}</span>
    106 |                     <Caption>{formattedDate}</Caption>
    107 |                 </div>
```

Verdict: _TBD_

### 17. cal.com — `apps/web/modules/settings/my-account/profile-skeleton.tsx:30` — no-physical-properties

"mr-6" is a physical utility: it does not flip in RTL. Use "me-6".

```
     28 |           <SkeletonText className="h-8 w-full" />
     29 | 
>    30 |           <SkeletonButton className="mr-6 h-8 w-20 rounded-md p-5" />
     31 |         </div>
     32 |       </SkeletonContainer>
```

Verdict: _TBD_

### 18. excalidraw — `packages/excalidraw/locales/ar-SA.json:599` — bidi-unsafe-string [neutral-after-ltr]

[neutral-after-ltr] "Excalidraw+" renders as "+Excalidraw". "+" sits between a Latin word and RTL text, so it takes the RTL direction and is drawn on the wrong side of "Excalidraw". Insert U+200E LEFT-TO-RIGHT MARK after "+", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: welcomeScreen.app.center_heading_plus)

```
    597 |       "center_heading_line2": "يُمكن محُ تخزين المتصفح بشكل غير متوقع.",
    598 |       "center_heading_line3": "احفظ عملك في ملف بانتظام لتجنب فقدانه.",
>   599 |       "center_heading_plus": "هل تريد الانتقال إلى Excalidraw+ بدلاً من ذلك؟",
    600 |       "menuHint": "التصدير، التفضيلات، اللغات..."
    601 |     },
```

Verdict: _TBD_

### 19. excalidraw — `packages/excalidraw/components/ImageExportDialog.tsx:206` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    204 |         <div className="ImageExportModal__preview__filename">
    205 |           {!nativeFileSystemSupported && (
>   206 |             <input
    207 |               type="text"
    208 |               className="TextInput"
```

Verdict: _TBD_

### 20. cal.com — `apps/web/modules/auth/oauth2/authorize-view.tsx:208` — no-physical-properties

"pl-5" is a physical utility: it does not flip in RTL. Use "ps-5".

```
    206 |             {t("associate_with_cal_account", { clientName: client.name })}
    207 |           </li>
>   208 |           <li className="relative pl-5">
    209 |             <span className="absolute left-0">&#10003;</span>
    210 |             {t("see_personal_info")}
```

Verdict: _TBD_

### 21. element-web — `apps/web/src/i18n/strings/fa.json:894` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "@bot:*" renders as "bot:*@". "@" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "@", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs_mjolnir.explainer_1)

```
    892 |         "error_removing_list_description": "لطفا مجددا اقدام کرده و برای کسب اطلاعات بیشتر کنسول مرورگر خود را مشاهده نمائید.",
    893 |         "error_removing_list_title": "لغو اشتراک از لیست با خطا همراه بود",
>   894 |         "explainer_1": "کاربران و سرورهایی که قصد نادیده گرفتن آن‌ها را دارید در این‌جا اضافه کنید. در %(brand)s از ستاره (*) برای مچ‌شدن با هر کاراکتری استفاده کنید. برای مثال، <code>@bot:*</code> همه‌ی کاربران یا سروره…
    895 |         "explainer_2": "نادیده‌گرفتن افراد توسط لیست تحریم صورت می‌گیرد که حاوی قوانینی برای تشخیص این است که چه کسی را تحریم کند. اضافه‌شدن به لیست تحریم به این معناست که کاربر/سرور بلاک شده و از دید شما پنهان خواهد بود…
    896 |         "lists": "شما هم‌اکنون مشترک شده‌اید در:",
```

Verdict: _TBD_

### 22. excalidraw — `packages/excalidraw/components/PublishLibrary.tsx:479` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    477 |                 </span>
    478 |               </div>
>   479 |               <input
    480 |                 type="text"
    481 |                 name="authorName"
```

Verdict: _TBD_

### 23. cal.com — `apps/web/modules/bookings/components/AvailableTimes.tsx:190` — no-physical-properties

"mr-1" is a physical utility: it does not flip in RTL. Use "me-1".

```
    188 |             <p className="flex items-center text-sm">
    189 |               <span
>   190 |                 className={classNames(colorClass, "mr-1 inline-block h-2 w-2 rounded-full")}
    191 |                 aria-hidden
    192 |               />
```

Verdict: _TBD_

### 24. element-web — `apps/web/src/i18n/strings/he.json:920` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "/jumptodate" renders as "jumptodate/". "/" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "/", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs.jump_to_date)

```
    918 |         "join_beta": "הצטרך לניסוי",
    919 |         "join_beta_reload": "הצטרפות לפיתוח תטען מחדש את %(brand)s.",
>   920 |         "jump_to_date": "קיפצו לתאריך (מוסיף /jumptodate וקפוץ לכותרות תאריך)",
    921 |         "latex_maths": "בצע מתמטיקה של LaTeX בהודעות",
    922 |         "leave_beta_reload": "עזיבת הניסוי תטען מחדש את %(brand)s."
```

Verdict: _TBD_

### 25. excalidraw — `packages/excalidraw/components/PublishLibrary.tsx:196` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    194 |             </span>
    195 |           </div>
>   196 |           <input
    197 |             type="text"
    198 |             ref={inputRef}
```

Verdict: _TBD_

### 26. cal.com — `apps/web/modules/signup-view.tsx:830` — no-physical-properties

"lg:pl-[6px]" is a physical utility: it does not flip in RTL. Use "lg:ps-[6px]".

```
    828 |               </>
    829 |             )}
>   830 |             <div className="hidden rounded-tl-2xl rounded-br-none rounded-bl-2xl border border-default border-r-0 border-dashed bg-black/3 lg:block lg:py-[6px] lg:pl-[6px] dark:bg-white/5">
    831 |               <img className="block dark:hidden" src="/mock-event-type-list.svg" alt="Cal.diy Booking Page" />
    832 |               {/* eslint-disable @next/next/no-img-element */}
```

Verdict: _TBD_

### 27. element-web — `apps/web/src/i18n/strings/he.json:933` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "@bot:" renders as "bot:@". "@" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "@", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs_mjolnir.explainer_1)

```
    931 |         "error_removing_list_description": "נסה שוב או הצג את המסוף שלך לקבלת רמזים.",
    932 |         "error_removing_list_title": "שגיאה בהסרת הרשמה מרשימה זו",
>   933 |         "explainer_1": "הוסף משתמשים ושרתים שתרצה להתעלם מהם כאן. השתמש בכוכביות כדי שאחוזים %(brand)s יתאימו לכל תו. לדוגמא, <code> @bot: * </code> יתעלם מכל המשתמשים שיש להם את השם 'בוט' בשרת כלשהו.",
    934 |         "explainer_2": "התעלמות מאנשים נעשית באמצעות רשימות איסור המכילות כללים למי לאסור. הרשמה להרשמה לרשימת איסורים פירושה שהמשתמשים / השרתים החסומים על ידי רשימה זו יוסתרו ממך.",
    935 |         "lists": "אתם רשומים אל:",
```

Verdict: _TBD_

### 28. jitsi-meet — `react/features/welcome/components/WelcomePage.web.tsx:235` — missing-dir-attribute

<input type="text"> has no dir attribute, so typed text always follows the page direction. Text in the other direction (English in an Arabic UI, Arabic in an English UI) is aligned to the wrong edge and its punctuation jumps: "Hello!" shows as "!Hello". Add dir="auto" so the field follows what the user types.

```
    233 |                                 <div className = 'enter-room-input-container'>
    234 |                                     <form onSubmit = { this._onFormSubmit }>
>   235 |                                         <input
    236 |                                             aria-disabled = 'false'
    237 |                                             aria-label = { t('welcomepage.accessibilityLabel.roomname') }
```

Verdict: _TBD_

### 29. cal.com — `apps/web/components/settings/DisableTwoFactorModal.tsx:118` — no-physical-properties

"mr-auto" is a physical utility: it does not flip in RTL. Use "me-auto".

```
    116 |             <Button
    117 |               color="minimal"
>   118 |               className="mr-auto"
    119 |               onClick={() => {
    120 |                 setTwoFactorLostAccess(!twoFactorLostAccess);
```

Verdict: _TBD_

### 30. element-web — `apps/web/src/i18n/strings/fa.json:905` — bidi-unsafe-string [neutral-before-ltr]

[neutral-before-ltr] "@bot:*" renders as "bot:*@". "@" is a neutral character sitting between RTL text and a Latin word, so the bidi algorithm gives it the paragraph's RTL direction and moves it to the far side of the word. Insert U+200E LEFT-TO-RIGHT MARK before "@", or isolate the token with LRI (U+2066) … PDI (U+2069) / <bdi>. (key: labs_mjolnir.personal_new_placeholder)

```
    903 |         "personal_heading": "لیست تحریم شخصی",
    904 |         "personal_new_label": "شناسه‌ی سرور یا کاربر مورد نظر برای نادیده‌گرفتن",
>   905 |         "personal_new_placeholder": "برای مثال: @bot:* یا example.org",
    906 |         "personal_section": "شما در حال حاضر این موارد را نادیده گرفته‌اید:",
    907 |         "room_name": "لیست تحریم‌های من",
```

Verdict: _TBD_

