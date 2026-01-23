Include "../../../scpcb/StrictLoads.bb"
Include "../../../scpcb/Menu.bb"

Global LoadingBack%
Global LoadingScreenAmount%
Global SelectedLoadingScreen.LoadingScreens
Global LoadingScreenText%
Global BlinkMeterIMG%

Function InitLoadingScreensDemo()
    LoadingScreenAmount = 0

    Local ls.LoadingScreens

    ls = New LoadingScreens
    LoadingScreenAmount = LoadingScreenAmount + 1
    ls\id = LoadingScreenAmount
    ls\title = "DEFAULT"
    ls\imgpath = "1499.jpg"
    ls\txt[0] = "Secure. Contain. Protect."
    ls\txtamount = 1
    ls\disablebackground = 0
    ls\alignx = 0
    ls\aligny = 0

    ls = New LoadingScreens
    LoadingScreenAmount = LoadingScreenAmount + 1
    ls\id = LoadingScreenAmount
    ls\title = "DEFAULT"
    ls\imgpath = "173.jpg"
    ls\txt[0] = "Don't blink."
    ls\txtamount = 1
    ls\disablebackground = 0
    ls\alignx = 0
    ls\aligny = 0

    ls = New LoadingScreens
    LoadingScreenAmount = LoadingScreenAmount + 1
    ls\id = LoadingScreenAmount
    ls\title = "CWM"
    ls\imgpath = "079.jpg"
    ls\txt[0] = "It controls the doors."
    ls\txtamount = 1
    ls\disablebackground = 0
    ls\alignx = 0
    ls\aligny = 0
End Function

Function Main()
    MenuScale = 1
    Graphics3D 1024, 768, 32, 2

    BlinkMeterIMG = LoadImage_Strict("GFX\BlinkMeter.jpg")
    LoadingBack = LoadImage_Strict("Loadingscreens\1499.jpg")

    Font1 = AALoadFont("GFX\font\cour\Courier New.ttf", 18, 0,0,0)
    Font2 = AALoadFont("GFX\font\courbd\Courier New.ttf", 42, 0,0,0)

    InitLoadingScreensDemo()
End Function