!macro customUnInstall
  ; Remove Vespo data folders created during app usage.
  RMDir /r "$PROFILE\.vespo"
  RMDir /r "$APPDATA\vespo-desktop"
  RMDir /r "$LOCALAPPDATA\vespo-desktop"
  RMDir /r "$LOCALAPPDATA\Vespo"
!macroend
