; SPDX-License-Identifier: AGPL-3.0-only
; AssetForge kurulum sihirbazı özelleştirmeleri. electron-builder bu dosyayı NSIS betiğinin başına ekler
; (build/installer.nsh). Görseller: build/installerSidebar.bmp, installerHeader.bmp, uninstallerSidebar.bmp
; ve onları üreten scripts/installer-art.
;
; Sayfalar: Karşılama → Lisans → Kurulum türü → Klasör → Seçenekler (kısayollar) → Kurulum → Bitiş

!include nsDialogs.nsh
!include LogicLib.nsh

; Uygulamanın renkleri: başlık şeridi, karşılama ve bitiş sayfaları koyu temada
!define MUI_BGCOLOR "0B0D13"
!define MUI_TEXTCOLOR "EEF0F5"
!define MUI_HEADER_TRANSPARENT_TEXT
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

!ifndef BUILD_UNINSTALLER
  Var afDesktop
  Var afDesktopBox
!endif

; Metinler: Türkçe (1055) ve İngilizce (1033); Windows diline göre seçilir
!macro customHeader
  !ifndef BUILD_UNINSTALLER
    LangString afWelcomeTitle 1055 "AssetForge kurulumuna hoş geldin"
    LangString afWelcomeTitle 1033 "Welcome to AssetForge"
    LangString afWelcomeText 1055 "AssetForge; 3D model, doku, ses ve animasyon üretimini tek bir atölyede toplar ve sonuçları doğrudan Unreal Engine'e aktarır.$\r$\n$\r$\nKurulum yaklaşık 400 MB yer kaplar. Yapay zekâ servisleri kendi hesabınla çalışır; anahtarlarını kurulumdan sonra Ayarlar → Hesaplar ve API'den tek tıkla bağlayabilirsin.$\r$\n$\r$\nDevam etmek için İleri'ye tıkla."
    LangString afWelcomeText 1033 "AssetForge brings 3D model, texture, sound and animation generation into one studio and sends the results straight to Unreal Engine.$\r$\n$\r$\nThe app needs about 400 MB. AI services run with your own accounts; connect them after setup in Settings → Accounts and API.$\r$\n$\r$\nClick Next to continue."
    LangString afOptTitle 1055 "Kurulum seçenekleri"
    LangString afOptTitle 1033 "Setup options"
    LangString afOptSub 1055 "AssetForge'a nereden ulaşmak istediğini seç."
    LangString afOptSub 1033 "Choose where you want to open AssetForge from."
    LangString afOptDesktop 1055 "Masaüstüne kısayol ekle"
    LangString afOptDesktop 1033 "Add a desktop shortcut"
    LangString afOptStart 1055 "Başlat menüsüne eklenir (Windows aramasında da çıkar)."
    LangString afOptStart 1033 "It is added to the Start menu (and shows up in Windows search)."
    LangString afOptTaskbar 1055 "Görev çubuğuna sabitlemek için: AssetForge açıkken görev çubuğundaki simgesine sağ tıklayıp “Görev çubuğuna sabitle”yi seç. Windows, kurulum programlarının uygulamaları görev çubuğuna kendiliğinden sabitlemesine izin vermez. Sabitledikten sonra simgeye sağ tıklayınca Atölye, Kütüphane, Animasyon ve Ayarlar'a doğrudan gidebilirsin."
    LangString afOptTaskbar 1033 "To pin it to the taskbar: while AssetForge is open, right-click its taskbar icon and choose “Pin to taskbar”. Windows does not let installers pin apps by themselves. Once pinned, right-click the icon to jump straight to the Studio, Library, Animation or Settings."
    LangString afFinishTitle 1055 "AssetForge hazır"
    LangString afFinishTitle 1033 "AssetForge is ready"
    LangString afFinishText 1055 "Kurulum tamamlandı.$\r$\n$\r$\nİlk açılışta Ayarlar → Hesaplar ve API'den Claude, Meshy ve ElevenLabs hesaplarını bağla. Animasyon için Ayarlar → Animasyon'dan Kimodo kurulumunu başlatabilirsin.$\r$\n$\r$\nİpucu: Uygulama açıkken görev çubuğundaki simgeye sağ tıklayıp “Görev çubuğuna sabitle”yi seç."
    LangString afFinishText 1033 "Setup is complete.$\r$\n$\r$\nOn first launch, connect your Claude, Meshy and ElevenLabs accounts in Settings → Accounts and API. For animation, start the Kimodo setup in Settings → Animation.$\r$\n$\r$\nTip: while the app is open, right-click its taskbar icon and choose “Pin to taskbar”."
  !else
    LangString afUnData 1055 "AssetForge'un ayarlarını, şifreli API anahtarlarını ve günlüklerini de silmek ister misin?$\r$\n$\r$\nVarsayılan klasördeyse Kimodo modelleri (~25 GB) de silinir. Proje klasörlerin ve ürettiğin asset'ler silinmez.$\r$\n$\r$\nUygulamayı daha sonra yeniden kuracaksan Hayır'ı seç."
    LangString afUnData 1033 "Also delete AssetForge's settings, encrypted API keys and logs?$\r$\n$\r$\nIf they are in the default folder, Kimodo models (~25 GB) are deleted too. Your project folders and generated assets are not deleted.$\r$\n$\r$\nChoose No if you plan to install the app again."
  !endif
!macroend

!ifndef BUILD_UNINSTALLER

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "$(afWelcomeTitle)"
    !define MUI_WELCOMEPAGE_TITLE_3LINES
    !define MUI_WELCOMEPAGE_TEXT "$(afWelcomeText)"
    !insertmacro skipPageIfUpdated
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; Klasör seçiminden sonra: kısayol seçenekleri
  ; Fonksiyonlar makro içinde: bu dosya MUI2/common.nsh'den önce dahil edilir, makro ise sayfalar tanımlanırken açılır
  !macro customPageAfterChangeDir
    Page custom afOptionsShow afOptionsLeave
    Function afOptionsShow
      ${if} ${isUpdated}
        Abort
      ${endif}
      ${if} $afDesktop == ""
        StrCpy $afDesktop ${BST_CHECKED}
      ${endif}
      !insertmacro MUI_HEADER_TEXT "$(afOptTitle)" "$(afOptSub)"
      nsDialogs::Create 1018
      Pop $0
      ${if} $0 == error
        Abort
      ${endif}

      ${NSD_CreateCheckbox} 0 6u 100% 12u "$(afOptDesktop)"
      Pop $afDesktopBox
      ${NSD_SetState} $afDesktopBox $afDesktop

      ${NSD_CreateLabel} 12u 24u -12u 12u "$(afOptStart)"
      Pop $0

      ${NSD_CreateHLine} 0 46u 100% 1u ""
      Pop $0

      ${NSD_CreateLabel} 0 56u 100% 60u "$(afOptTaskbar)"
      Pop $0

      nsDialogs::Show
    FunctionEnd

    Function afOptionsLeave
      ${NSD_GetState} $afDesktopBox $afDesktop
    FunctionEnd
  !macroend

  ; Bitiş sayfası: kendi başlığı ve ipuçlarıyla (uygulamayı başlat kutusu korunur)
  !macro customFinishPage
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_TITLE "$(afFinishTitle)"
    !define MUI_FINISHPAGE_TITLE_3LINES
    !define MUI_FINISHPAGE_TEXT "$(afFinishText)"
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
    !insertmacro MUI_PAGE_FINISH
  !macroend

  ; Masaüstü kısayolunu electron-builder oluşturur (doğru AppUserModelID ile); istenmediyse kaldır
  !macro customInstall
    ${ifNot} ${isUpdated}
    ${andIf} $afDesktop == ${BST_UNCHECKED}
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
    ${endif}
  !macroend

!else

  ; Kaldırırken kullanıcı verisini silmeyi sor (güncellemede ve sessiz kaldırmada sorma)
  !macro customUnInstall
    ${ifNot} ${isUpdated}
    ${andIfNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(afUnData)" IDNO afKeepData
      SetShellVarContext current
      RMDir /r "$APPDATA\AssetForge"
      afKeepData:
    ${endif}
  !macroend

!endif
