Global MenuBack% = LoadImage_Strict("GFX\menu\back.jpg")
Global MenuText% = LoadImage_Strict("GFX\menu\scptext.jpg")
Global Menu173% = LoadImage_Strict("GFX\menu\173back.jpg")
MenuWhite = LoadImage_Strict("GFX\menu\menuwhite.jpg")
MenuBlack = LoadImage_Strict("GFX\menu\menublack.jpg")
MaskImage MenuBlack, 255,255,0
Global QuickLoadIcon% = LoadImage_Strict("GFX\menu\QuickLoading.png")

ResizeImage(MenuBack, ImageWidth(MenuBack) * MenuScale, ImageHeight(MenuBack) * MenuScale)
ResizeImage(MenuText, ImageWidth(MenuText) * MenuScale, ImageHeight(MenuText) * MenuScale)
ResizeImage(Menu173, ImageWidth(Menu173) * MenuScale, ImageHeight(Menu173) * MenuScale)
ResizeImage(QuickLoadIcon, ImageWidth(QuickLoadIcon) * MenuScale, ImageHeight(QuickLoadIcon) * MenuScale)

For i = 0 To 3
	ArrowIMG(i) = LoadImage_Strict("GFX\menu\arrow.png")
	RotateImage(ArrowIMG(i), 90 * i)
	HandleImage(ArrowIMG(i), 0, 0)
Next

Global RandomSeed$

Dim MenuBlinkTimer%(2), MenuBlinkDuration%(2)
MenuBlinkTimer%(0) = 1
MenuBlinkTimer%(1) = 1

Global MenuStr$, MenuStrX%, MenuStrY%

Global MainMenuTab%


Global IntroEnabled% = GetINIInt(OptionFile, "options", "intro enabled")

Global SelectedInputBox%

Global SavePath$ = "Saves\"
Global SaveMSG$

;nykyisen tallennuksen nimi ja samalla missä kansiossa tallennustiedosto sijaitsee saves-kansiossa
Global CurrSave$

Global SaveGameAmount%
Dim SaveGames$(SaveGameAmount+1) 
Dim SaveGameTime$(SaveGameAmount + 1)
Dim SaveGameDate$(SaveGameAmount + 1)
Dim SaveGameVersion$(SaveGameAmount + 1)

Global SavedMapsAmount% = 0
Dim SavedMaps$(SavedMapsAmount+1)
Dim SavedMapsAuthor$(SavedMapsAmount+1)

Global SelectedMap$

LoadSaveGames()

Global CurrLoadGamePage% = 0

Function UpdateMainMenu()
	Local x%, y%, width%, height%, temp%
	
	Color 0,0,0
	Rect 0,0,GraphicWidth,GraphicHeight,True
	
	ShowPointer()
	
	DrawImage(MenuBack, 0, 0)
	
	If (MilliSecs2() Mod MenuBlinkTimer(0)) >= Rand(MenuBlinkDuration(0)) Then
		DrawImage(Menu173, GraphicWidth - ImageWidth(Menu173), GraphicHeight - ImageHeight(Menu173))
	EndIf
	
	If Rand(300) = 1 Then
		MenuBlinkTimer(0) = Rand(4000, 8000)
		MenuBlinkDuration(0) = Rand(200, 500)
	End If
	
	AASetFont Font1
	
	MenuBlinkTimer(1)=MenuBlinkTimer(1)-FPSfactor
	If MenuBlinkTimer(1) < MenuBlinkDuration(1) Then
		Color(50, 50, 50)
		AAText(MenuStrX + Rand(-5, 5), MenuStrY + Rand(-5, 5), MenuStr, True)
		If MenuBlinkTimer(1) < 0 Then
			MenuBlinkTimer(1) = Rand(700, 800)
			MenuBlinkDuration(1) = Rand(10, 35)
			MenuStrX = Rand(700, 1000) * MenuScale
			MenuStrY = Rand(100, 600) * MenuScale
			
			Select Rand(0, 22)
				Case 0, 2, 3
					MenuStr = "DON'T BLINK"
				Case 4, 5
					MenuStr = "Secure. Contain. Protect."
				Case 6, 7, 8
					MenuStr = "You want happy endings? Fuck you."
				Case 9, 10, 11
					MenuStr = "Sometimes we would have had time to scream."
				Case 12, 19
					MenuStr = "NIL"
				Case 13
					MenuStr = "NO"
				Case 14
					MenuStr = "black white black white black white gray"
				Case 15
					MenuStr = "Stone does not care"
				Case 16
					MenuStr = "9341"
				Case 17
					MenuStr = "It controls the doors"
				Case 18
					MenuStr = "e8m106]af173o+079m895w914"
				Case 20
					MenuStr = "It has taken over everything"
				Case 21
					MenuStr = "The spiral is growing"
				Case 22
					MenuStr = Chr(34)+"Some kind of gestalt effect due to massive reality damage."+Chr(34)
			End Select
		EndIf
	EndIf
	
	AASetFont Font2
	
	DrawImage(MenuText, GraphicWidth / 2 - ImageWidth(MenuText) / 2, GraphicHeight - 20 * MenuScale - ImageHeight(MenuText))
	
	If GraphicWidth > 1240 * MenuScale Then
		DrawTiledImageRect(MenuWhite, 0, 5, 512, 7 * MenuScale, 985.0 * MenuScale, 407.0 * MenuScale, (GraphicWidth - 1240 * MenuScale) + 300, 7 * MenuScale)
	EndIf
	
	If (Not MouseDown1)
		OnSliderID = 0
	EndIf
	
	If MainMenuTab = 0 Then
		For i% = 0 To 3
			temp = False
			x = 159 * MenuScale
			y = (286 + 100 * i) * MenuScale
			
			width = 400 * MenuScale
			height = 70 * MenuScale
			
			temp = (MouseHit1 And MouseOn(x, y, width, height))
			
			Local txt$
			Select i
				Case 0
					txt = "NEW GAME"
					RandomSeed = ""
					If temp Then 
						If Rand(15)=1 Then 
							Select Rand(13)
								Case 1 
									RandomSeed = "NIL"
								Case 2
									RandomSeed = "NO"
								Case 3
									RandomSeed = "d9341"
								Case 4
									RandomSeed = "5CP_I73"
								Case 5
									RandomSeed = "DONTBLINK"
								Case 6
									RandomSeed = "CRUNCH"
								Case 7
									RandomSeed = "die"
								Case 8
									RandomSeed = "HTAED"
								Case 9
									RandomSeed = "rustledjim"
								Case 10
									RandomSeed = "larry"
								Case 11
									RandomSeed = "JORGE"
								Case 12
									RandomSeed = "dirtymetal"
								Case 13
									RandomSeed = "whatpumpkin"
							End Select
						Else
							n = Rand(4,8)
							For i = 1 To n
								If Rand(3)=1 Then
									RandomSeed = RandomSeed + Rand(0,9)
								Else
									RandomSeed = RandomSeed + Chr(Rand(97,122))
								EndIf
							Next							
						EndIf
						
						;RandomSeed = MilliSecs()
						MainMenuTab = 1
					EndIf
				Case 1
					txt = "LOAD GAME"
					If temp Then
						LoadSaveGames()
						MainMenuTab = 2
					EndIf
				Case 2
					txt = "OPTIONS"
					If temp Then MainMenuTab = 3
				Case 3
					txt = "QUIT"
					If temp Then
						;DeInitExt
						;alDestroy()
						;FMOD_Pause(MusicCHN)
						;FMOD_CloseStream(CurrMusicStream)
						;FMOD_Close()
						;FMOD_StopStream(CurrMusicStream)
						FSOUND_Stream_Stop(CurrMusicStream)
						;FSOUND_Close()
						End
					EndIf
			End Select
			
			DrawButton(x, y, width, height, txt)
			
			;rect(x + 4, y + 4, width - 8, height - 8)
			;color 255, 255, 255	
			;text(x + width / 2, y + height / 2, Str, True, True)
		Next	
		
	Else
		
		x = 159 * MenuScale
		y = 286 * MenuScale
		
		width = 400 * MenuScale
		height = 70 * MenuScale
		
		DrawFrame(x, y, width, height)
		
		If DrawButton(x + width + 20 * MenuScale, y, 580 * MenuScale - width - 20 * MenuScale, height, "BACK", False) Then 
			Select MainMenuTab
				Case 1
					PutINIValue(OptionFile, "options", "intro enabled", IntroEnabled%)
					MainMenuTab = 0
				Case 2
					CurrLoadGamePage = 0
					MainMenuTab = 0
				Case 3,5,6,7 ;save the options
					SaveOptionsINI()
					
					UserTrackCheck% = 0
					UserTrackCheck2% = 0
					
					AntiAlias Opt_AntiAlias
					MainMenuTab = 0
				Case 4 ;move back to the "new game" tab
					MainMenuTab = 1
					CurrLoadGamePage = 0
					MouseHit1 = False
				Default
					MainMenuTab = 0
			End Select
		EndIf
		
		Select MainMenuTab
			Case 1 ; New game
				;[Block]
				
				x = 159 * MenuScale
				y = 286 * MenuScale
				
				width = 400 * MenuScale
				height = 70 * MenuScale
				
				Color(255, 255, 255)
				AASetFont Font2
				AAText(x + width / 2, y + height / 2, "NEW GAME", True, True)
				
				x = 160 * MenuScale
				y = y + height + 20 * MenuScale
				width = 580 * MenuScale
				height = 330 * MenuScale
				
				DrawFrame(x, y, width, height)				
				
				AASetFont Font1
				
				AAText (x + 20 * MenuScale, y + 20 * MenuScale, "Name:")
				CurrSave = InputBox(x + 150 * MenuScale, y + 15 * MenuScale, 200 * MenuScale, 30 * MenuScale, CurrSave, 1)
				CurrSave = Left(CurrSave, 15)
				CurrSave = Replace(CurrSave,":","")
				CurrSave = Replace(CurrSave,".","")
				CurrSave = Replace(CurrSave,"/","")
				CurrSave = Replace(CurrSave,"\","")
				CurrSave = Replace(CurrSave,"<","")
				CurrSave = Replace(CurrSave,">","")
				CurrSave = Replace(CurrSave,"|","")
				CurrSave = Replace(CurrSave,"?","")
				CurrSave = Replace(CurrSave,Chr(34),"")
				CurrSave = Replace(CurrSave,"*","")
				
				Color 255,255,255
				If SelectedMap = "" Then
					AAText (x + 20 * MenuScale, y + 60 * MenuScale, "Map seed:")
					RandomSeed = Left(InputBox(x+150*MenuScale, y+55*MenuScale, 200*MenuScale, 30*MenuScale, RandomSeed, 3),15)	
				Else
					AAText (x + 20 * MenuScale, y + 60 * MenuScale, "Selected map:")
					Color (255, 255, 255)
					Rect(x+150*MenuScale, y+55*MenuScale, 200*MenuScale, 30*MenuScale)
					Color (0, 0, 0)
					Rect(x+150*MenuScale+2, y+55*MenuScale+2, 200*MenuScale-4, 30*MenuScale-4)
					
					Color (255, 0,0)
					If Len(SelectedMap)>15 Then
						AAText(x+150*MenuScale + 100*MenuScale, y+55*MenuScale + 15*MenuScale, Left(SelectedMap,14)+"...", True, True)
					Else
						AAText(x+150*MenuScale + 100*MenuScale, y+55*MenuScale + 15*MenuScale, SelectedMap, True, True)
					EndIf
					
					If DrawButton(x+370*MenuScale, y+55*MenuScale, 120*MenuScale, 30*MenuScale, "Deselect", False) Then
						SelectedMap=""
					EndIf
				EndIf	
				
				AAText(x + 20 * MenuScale, y + 110 * MenuScale, "Enable intro sequence:")
				IntroEnabled = DrawTick(x + 280 * MenuScale, y + 110 * MenuScale, IntroEnabled)	
				
				;Local modeName$, modeDescription$, selectedDescription$
				AAText (x + 20 * MenuScale, y + 150 * MenuScale, "Difficulty:")				
				For i = SAFE To CUSTOM
					If DrawTick(x + 20 * MenuScale, y + (180+30*i) * MenuScale, (SelectedDifficulty = difficulties(i))) Then SelectedDifficulty = difficulties(i)
					Color(difficulties(i)\r,difficulties(i)\g,difficulties(i)\b)
					AAText(x + 60 * MenuScale, y + (180+30*i) * MenuScale, difficulties(i)\name)
				Next
				
				Color(255, 255, 255)
				DrawFrame(x + 150 * MenuScale,y + 155 * MenuScale, 410*MenuScale, 150*MenuScale)
				
				If SelectedDifficulty\customizable Then
					SelectedDifficulty\permaDeath =  DrawTick(x + 160 * MenuScale, y + 165 * MenuScale, (SelectedDifficulty\permaDeath))
					AAText(x + 200 * MenuScale, y + 165 * MenuScale, "Permadeath")
					
					If DrawTick(x + 160 * MenuScale, y + 195 * MenuScale, SelectedDifficulty\saveType = SAVEANYWHERE And (Not SelectedDifficulty\permaDeath), SelectedDifficulty\permaDeath) Then 
						SelectedDifficulty\saveType = SAVEANYWHERE
					Else
						SelectedDifficulty\saveType = SAVEONSCREENS
					EndIf
					
					AAText(x + 200 * MenuScale, y + 195 * MenuScale, "Save anywhere")	
					
					SelectedDifficulty\aggressiveNPCs =  DrawTick(x + 160 * MenuScale, y + 225 * MenuScale, SelectedDifficulty\aggressiveNPCs)
					AAText(x + 200 * MenuScale, y + 225 * MenuScale, "Aggressive NPCs")
					
					;Other factor's difficulty
					Color 255,255,255
					DrawImage ArrowIMG(1),x + 155 * MenuScale, y+251*MenuScale
					If MouseHit1
						If ImageRectOverlap(ArrowIMG(1),x + 155 * MenuScale, y+251*MenuScale, ScaledMouseX(),ScaledMouseY(),0,0)
							If SelectedDifficulty\otherFactors < HARD
								SelectedDifficulty\otherFactors = SelectedDifficulty\otherFactors + 1
							Else
								SelectedDifficulty\otherFactors = EASY
							EndIf
							PlaySound_Strict(ButtonSFX)
						EndIf
					EndIf
					Color 255,255,255
					Select SelectedDifficulty\otherFactors
						Case EASY
							AAText(x + 200 * MenuScale, y + 255 * MenuScale, "Other difficulty factors: Easy")
						Case NORMAL
							AAText(x + 200 * MenuScale, y + 255 * MenuScale, "Other difficulty factors: Normal")
						Case HARD
							AAText(x + 200 * MenuScale, y + 255 * MenuScale, "Other difficulty factors: Hard")
					End Select
				Else
					RowText(SelectedDifficulty\description, x+160*MenuScale, y+160*MenuScale, (410-20)*MenuScale, 200)					
				EndIf
				
				If DrawButton(x, y + height + 20 * MenuScale, 160 * MenuScale, 70 * MenuScale, "Load map", False) Then
					MainMenuTab = 4
					LoadSavedMaps()
				EndIf
				
				AASetFont Font2
				
				If DrawButton(x + 420 * MenuScale, y + height + 20 * MenuScale, 160 * MenuScale, 70 * MenuScale, "START", False) Then
					If CurrSave = "" Then CurrSave = "untitled"
					
					If RandomSeed = "" Then
						RandomSeed = Abs(MilliSecs())
					EndIf
					
					SeedRnd GenerateSeedNumber(RandomSeed)
					
					Local SameFound% = False
					
					For  i% = 1 To SaveGameAmount
						If SaveGames(i - 1) = CurrSave Then SameFound = SameFound + 1
					Next
						
					If SameFound > 0 Then CurrSave = CurrSave + " (" + (SameFound + 1) + ")"
					
					LoadEntities()
					LoadAllSounds()
					InitNewGame()
					MainMenuOpen = False
					FlushKeys()
					FlushMouse()
					
					PutINIValue(OptionFile, "options", "intro enabled", IntroEnabled%)
					
				EndIf
				
				;[End Block]
			Case 2 ;load game
				;[Block]
				
				y = y + height + 20 * MenuScale
				width = 580 * MenuScale
				;height = 300 * MenuScale
				height = 510 * MenuScale
				
				DrawFrame(x, y, width, height)
				
				x = 159 * MenuScale
				y = 286 * MenuScale
				
				width = 400 * MenuScale
				height = 70 * MenuScale
				
				Color(255, 255, 255)
				AASetFont Font2
				AAText(x + width / 2, y + height / 2, "LOAD GAME", True, True)
				
				x = 160 * MenuScale
				y = y + height + 20 * MenuScale
				width = 580 * MenuScale
				height = 296 * MenuScale
				
				;AASetFont Font1	
				
				AASetFont Font2
				
				If CurrLoadGamePage < Ceil(Float(SaveGameAmount)/6.0)-1 And SaveMSG = "" Then 
					If DrawButton(x+530*MenuScale, y + 510*MenuScale, 50*MenuScale, 55*MenuScale, ">") Then
						CurrLoadGamePage = CurrLoadGamePage+1
					EndIf
				Else
					DrawFrame(x+530*MenuScale, y + 510*MenuScale, 50*MenuScale, 55*MenuScale)
					Color(100, 100, 100)
					AAText(x+555*MenuScale, y + 537.5*MenuScale, ">", True, True)
				EndIf
				If CurrLoadGamePage > 0 And SaveMSG = "" Then
					If DrawButton(x, y + 510*MenuScale, 50*MenuScale, 55*MenuScale, "<") Then
						CurrLoadGamePage = CurrLoadGamePage-1
					EndIf
				Else
					DrawFrame(x, y + 510*MenuScale, 50*MenuScale, 55*MenuScale)
					Color(100, 100, 100)
					AAText(x+25*MenuScale, y + 537.5*MenuScale, "<", True, True)
				EndIf
				
				DrawFrame(x+50*MenuScale,y+510*MenuScale,width-100*MenuScale,55*MenuScale)
				
				AAText(x+(width/2.0),y+536*MenuScale,"Page "+Int(Max((CurrLoadGamePage+1),1))+"/"+Int(Max((Int(Ceil(Float(SaveGameAmount)/6.0))),1)),True,True)
				
				AASetFont Font1
				
				If CurrLoadGamePage > Ceil(Float(SaveGameAmount)/6.0)-1 Then
					CurrLoadGamePage = CurrLoadGamePage - 1
				EndIf
				
				If SaveGameAmount = 0 Then
					AAText (x + 20 * MenuScale, y + 20 * MenuScale, "No saved games.")
				Else
					x = x + 20 * MenuScale
					y = y + 20 * MenuScale
					
					For i% = (1+(6*CurrLoadGamePage)) To 6+(6*CurrLoadGamePage)
						If i <= SaveGameAmount Then
							DrawFrame(x,y,540* MenuScale, 70* MenuScale)
							
							If SaveGameVersion(i - 1) <> CompatibleNumber And SaveGameVersion(i - 1) <> "1.3.10" Then
								Color 255,0,0
							Else
								Color 255,255,255
							EndIf
							
							AAText(x + 20 * MenuScale, y + 10 * MenuScale, SaveGames(i - 1))
							AAText(x + 20 * MenuScale, y + (10+18) * MenuScale, SaveGameTime(i - 1)) ;y + (10+23) * MenuScale
							AAText(x + 120 * MenuScale, y + (10+18) * MenuScale, SaveGameDate(i - 1))
							AAText(x + 20 * MenuScale, y + (10+36) * MenuScale, SaveGameVersion(i - 1))
							
							If SaveMSG = "" Then
								If SaveGameVersion(i - 1) <> CompatibleNumber And SaveGameVersion(i - 1) <> "1.3.10" Then
									DrawFrame(x + 280 * MenuScale, y + 20 * MenuScale, 100 * MenuScale, 30 * MenuScale)
									Color(255, 0, 0)
									AAText(x + 330 * MenuScale, y + 34 * MenuScale, "Load", True, True)
								Else
									If DrawButton(x + 280 * MenuScale, y + 20 * MenuScale, 100 * MenuScale, 30 * MenuScale, "Load", False) Then
										LoadEntities()
										LoadAllSounds()
										LoadGame(SavePath + SaveGames(i - 1) + "\")
										CurrSave = SaveGames(i - 1)
										InitLoadGame()
										MainMenuOpen = False
									EndIf
								EndIf
								
								If DrawButton(x + 400 * MenuScale, y + 20 * MenuScale, 100 * MenuScale, 30 * MenuScale, "Delete", False) Then
									SaveMSG = SaveGames(i - 1)
									DebugLog SaveMSG
									Exit
								EndIf
							Else
								DrawFrame(x + 280 * MenuScale, y + 20 * MenuScale, 100 * MenuScale, 30 * MenuScale)
								If SaveGameVersion(i - 1) <> CompatibleNumber And SaveGameVersion(i - 1) <> "1.3.10" Then
									Color(255, 0, 0)
								Else
									Color(100, 100, 100)
								EndIf
								AAText(x + 330 * MenuScale, y + 34 * MenuScale, "Load", True, True)
								
								DrawFrame(x + 400 * MenuScale, y + 20 * MenuScale, 100 * MenuScale, 30 * MenuScale)
								Color(100, 100, 100)
								AAText(x + 450 * MenuScale, y + 34 * MenuScale, "Delete", True, True)
							EndIf
							
							y = y + 80 * MenuScale
						Else
							Exit
						EndIf
					Next
					
					If SaveMSG <> ""
						x = 740 * MenuScale
						y = 376 * MenuScale
						DrawFrame(x, y, 420 * MenuScale, 200 * MenuScale)
						RowText("Are you sure you want to delete this save?", x + 20 * MenuScale, y + 15 * MenuScale, 400 * MenuScale, 200 * MenuScale)
						;AAText(x + 20 * MenuScale, y + 15 * MenuScale, "Are you sure you want to delete this save?")
						If DrawButton(x + 50 * MenuScale, y + 150 * MenuScale, 100 * MenuScale, 30 * MenuScale, "Yes", False) Then
							DeleteFile(CurrentDir() + SavePath + SaveMSG + "\save.txt")
							DeleteDir(CurrentDir() + SavePath + SaveMSG)
							SaveMSG = ""
							LoadSaveGames()
						EndIf
						If DrawButton(x + 250 * MenuScale, y + 150 * MenuScale, 100 * MenuScale, 30 * MenuScale, "No", False) Then
							SaveMSG = ""
						EndIf
					EndIf
				EndIf
				
				
				
				;[End Block]
			Case 3,5,6,7 ;options
				;[Block]
				
				x = 159 * MenuScale
				y = 286 * MenuScale
				
				width = 400 * MenuScale
				height = 70 * MenuScale
				
				Color(255, 255, 255)
				AASetFont Font2
				AAText(x + width / 2, y + height / 2, "OPTIONS", True, True)
				
				x = 160 * MenuScale
				y = y + height + 20 * MenuScale
				width = 580 * MenuScale
				height = 60 * MenuScale
				DrawFrame(x, y, width, height)
				
				Color 0,255,0
				If MainMenuTab = 3
					Rect(x+15*MenuScale,y+10*MenuScale,(width/5)+10*MenuScale,(height/2)+10*MenuScale,True)
				ElseIf MainMenuTab = 5
					Rect(x+155*MenuScale,y+10*MenuScale,(width/5)+10*MenuScale,(height/2)+10*MenuScale,True)
				ElseIf MainMenuTab = 6
					Rect(x+295*MenuScale,y+10*MenuScale,(width/5)+10*MenuScale,(height/2)+10*MenuScale,True)
				ElseIf MainMenuTab = 7
					Rect(x+435*MenuScale,y+10*MenuScale,(width/5)+10*MenuScale,(height/2)+10*MenuScale,True)
				EndIf
				
				Color 255,255,255
				If DrawButton(x+20*MenuScale,y+15*MenuScale,width/5,height/2, "GRAPHICS", False) Then MainMenuTab = 3
				If DrawButton(x+160*MenuScale,y+15*MenuScale,width/5,height/2, "AUDIO", False) Then MainMenuTab = 5
				If DrawButton(x+300*MenuScale,y+15*MenuScale,width/5,height/2, "CONTROLS", False) Then MainMenuTab = 6
				If DrawButton(x+440*MenuScale,y+15*MenuScale,width/5,height/2, "ADVANCED", False) Then MainMenuTab = 7
				
				AASetFont Font1
				y = y + 70 * MenuScale
				
				If MainMenuTab <> 5
					UserTrackCheck% = 0
					UserTrackCheck2% = 0
				EndIf
				
				Local tx# = x+width
				Local ty# = y
				Local tw# = 400*MenuScale
				Local th# = 150*MenuScale
				
				;DrawOptionsTooltip(tx,ty,tw,th,"")
				
				If MainMenuTab = 3 ;Graphics
					;[Block]
					;height = 380 * MenuScale
					height = 330 * MenuScale
					DrawFrame(x, y, width, height)
					
					y=y+20*MenuScale
					
					Color 255,255,255				
					AAText(x + 20 * MenuScale, y, "Enable bump mapping:")	
					BumpEnabled = DrawTick(x + 310 * MenuScale, y + MenuScale, BumpEnabled)
					If MouseOn(x + 310 * MenuScale, y + MenuScale, 20*MenuScale,20*MenuScale) And OnSliderID=0
						;DrawTooltip("Not available in this version")
						DrawOptionsTooltip(tx,ty,tw,th,"bump")
					EndIf
					
					y=y+30*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "VSync:")
					Vsync% = DrawTick(x + 310 * MenuScale, y + MenuScale, Vsync%)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale) And OnSliderID=0
						DrawOptionsTooltip(tx,ty,tw,th,"vsync")
					EndIf
					
					y=y+30*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Anti-aliasing:")
					Opt_AntiAlias = DrawTick(x + 310 * MenuScale, y + MenuScale, Opt_AntiAlias%)
					;AAText(x + 20 * MenuScale, y + 15 * MenuScale, "(fullscreen mode only)")
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale) And OnSliderID=0
						DrawOptionsTooltip(tx,ty,tw,th,"antialias")
					EndIf
					
					y=y+30*MenuScale ;40
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Enable room lights:")
					EnableRoomLights = DrawTick(x + 310 * MenuScale, y + MenuScale, EnableRoomLights)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale) And OnSliderID=0
						DrawOptionsTooltip(tx,ty,tw,th,"roomlights")
					EndIf
					
					y=y+30*MenuScale
					
					;Local prevGamma# = ScreenGamma
					ScreenGamma = (SlideBar(x + 310*MenuScale, y+6*MenuScale, 150*MenuScale, ScreenGamma*50.0)/50.0)
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Screen gamma")
					If MouseOn(x+310*MenuScale,y+6*MenuScale,150*MenuScale+14,20) And OnSliderID=0
						DrawOptionsTooltip(tx,ty,tw,th,"gamma",ScreenGamma)
					EndIf
					
					y=y+50*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Particle amount:")
					ParticleAmount = Slider3(x+310*MenuScale,y+6*MenuScale,150*MenuScale,ParticleAmount,2,"MINIMAL","REDUCED","FULL")
					If (MouseOn(x + 310 * MenuScale, y-6*MenuScale, 150*MenuScale+14, 20) And OnSliderID=0) Or OnSliderID=2
						DrawOptionsTooltip(tx,ty,tw,th,"particleamount",ParticleAmount)
					EndIf
					
					y=y+50*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Texture LOD Bias:")
					TextureDetails = Slider5(x+310*MenuScale,y+6*MenuScale,150*MenuScale,TextureDetails,3,"0.8","0.4","0.0","-0.4","-0.8")
					Select TextureDetails%
						Case 0
							TextureFloat# = 0.8
						Case 1
							TextureFloat# = 0.4
						Case 2
							TextureFloat# = 0.0
						Case 3
							TextureFloat# = -0.4
						Case 4
							TextureFloat# = -0.8
					End Select
					TextureLodBias TextureFloat
					If (MouseOn(x+310*MenuScale,y-6*MenuScale,150*MenuScale+14,20) And OnSliderID=0) Or OnSliderID=3
						DrawOptionsTooltip(tx,ty,tw,th+100*MenuScale,"texquality")
					EndIf
					
					y=y+50*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Save textures in the VRAM:")
					EnableVRam = DrawTick(x + 310 * MenuScale, y + MenuScale, EnableVRam)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale) And OnSliderID=0
						DrawOptionsTooltip(tx,ty,tw,th,"vram")
					EndIf
					
					;[End Block]
				ElseIf MainMenuTab = 5 ;Audio
					;[Block]
					height = 220 * MenuScale
					DrawFrame(x, y, width, height)	
					
					y = y + 20*MenuScale
					
					MusicVolume = (SlideBar(x + 310*MenuScale, y-4*MenuScale, 150*MenuScale, MusicVolume*100.0)/100.0)
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Music volume:")
					If MouseOn(x+310*MenuScale,y-4*MenuScale,150*MenuScale+14,20)
						DrawOptionsTooltip(tx,ty,tw,th,"musicvol",MusicVolume)
					EndIf
					
					y = y + 40*MenuScale
					
					;SFXVolume = (SlideBar(x + 310*MenuScale, y-4*MenuScale, 150*MenuScale, SFXVolume*100.0)/100.0)
					PrevSFXVolume = (SlideBar(x + 310*MenuScale, y-4*MenuScale, 150*MenuScale, SFXVolume*100.0)/100.0)
					SFXVolume = PrevSFXVolume
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Sound volume:")
					If MouseOn(x+310*MenuScale,y-4*MenuScale,150*MenuScale+14,20)
						DrawOptionsTooltip(tx,ty,tw,th,"soundvol",PrevSFXVolume)
					EndIf
					;If MouseDown1 Then
					;	If MouseX() >= x And MouseX() <= x + width + 14 And MouseY() >= y And MouseY() <= y + 20 Then
					;		PlayTestSound(True)
					;	Else
					;		PlayTestSound(False)
					;	EndIf
					;Else
					;	PlayTestSound(False)
					;EndIf
					
					y = y + 30*MenuScale
					
					Color 255,255,255
					AAText x + 20 * MenuScale, y, "Sound auto-release:"
					EnableSFXRelease = DrawTick(x + 310 * MenuScale, y + MenuScale, EnableSFXRelease)
					If EnableSFXRelease_Prev% <> EnableSFXRelease
						If EnableSFXRelease%
							For snd.Sound = Each Sound
								For i=0 To 31
									If snd\channels[i]<>0 Then
										If ChannelPlaying(snd\channels[i]) Then
											StopChannel(snd\channels[i])
										EndIf
									EndIf
								Next
								If snd\internalHandle<>0 Then
									FreeSound snd\internalHandle
									snd\internalHandle = 0
								EndIf
								snd\releaseTime = 0
							Next
						Else
							For snd.Sound = Each Sound
								If snd\internalHandle = 0 Then snd\internalHandle = LoadSound(snd\name)
							Next
						EndIf
						EnableSFXRelease_Prev% = EnableSFXRelease
					EndIf
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th+220*MenuScale,"sfxautorelease")
					EndIf
					y = y + 30*MenuScale
					
					Color 255,255,255
					AAText x + 20 * MenuScale, y, "Enable user tracks:"
					EnableUserTracks = DrawTick(x + 310 * MenuScale, y + MenuScale, EnableUserTracks)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"usertrack")
					EndIf
					
					If EnableUserTracks
						y = y + 30 * MenuScale
						Color 255,255,255
						AAText x + 20 * MenuScale, y, "User track mode:"
						UserTrackMode = DrawTick(x + 310 * MenuScale, y + MenuScale, UserTrackMode)
						If UserTrackMode
							AAText x + 350 * MenuScale, y + MenuScale, "Repeat"
						Else
							AAText x + 350 * MenuScale, y + MenuScale, "Random"
						EndIf
						If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
							DrawOptionsTooltip(tx,ty,tw,th,"usertrackmode")
						EndIf
						If DrawButton(x + 20 * MenuScale, y + 30 * MenuScale, 190 * MenuScale, 25 * MenuScale, "Scan for User Tracks",False)
							DebugLog "User Tracks Check Started"
							
							UserTrackCheck% = 0
							UserTrackCheck2% = 0
							
							Dir=ReadDir("SFX\Radio\UserTracks\")
							Repeat
								file$=NextFile(Dir)
								If file$="" Then Exit
								If FileType("SFX\Radio\UserTracks\"+file$) = 1 Then
									UserTrackCheck = UserTrackCheck + 1
									test = LoadSound("SFX\Radio\UserTracks\"+file$)
									If test<>0
										UserTrackCheck2 = UserTrackCheck2 + 1
									EndIf
									FreeSound test
								EndIf
							Forever
							CloseDir Dir
							
							DebugLog "User Tracks Check Ended"
						EndIf
						If MouseOn(x+20*MenuScale,y+30*MenuScale,190*MenuScale,25*MenuScale)
							DrawOptionsTooltip(tx,ty,tw,th,"usertrackscan")
						EndIf
						If UserTrackCheck%>0
							AAText x + 20 * MenuScale, y + 100 * MenuScale, "User tracks found ("+UserTrackCheck2+"/"+UserTrackCheck+" successfully loaded)"
						EndIf
					Else
						UserTrackCheck%=0
					EndIf
					;[End Block]
				ElseIf MainMenuTab = 6 ;Controls
					;[Block]
					height = 270 * MenuScale
					DrawFrame(x, y, width, height)	
					
					y = y + 20*MenuScale
					
					MouseSens = (SlideBar(x + 310*MenuScale, y-4*MenuScale, 150*MenuScale, (MouseSens+0.5)*100.0)/100.0)-0.5
					Color(255, 255, 255)
					AAText(x + 20 * MenuScale, y, "Mouse sensitivity:")
					If MouseOn(x+310*MenuScale,y-4*MenuScale,150*MenuScale+14,20)
						DrawOptionsTooltip(tx,ty,tw,th,"mousesensitivity",MouseSens)
					EndIf
					
					y = y + 40*MenuScale
					
					Color(255, 255, 255)
					AAText(x + 20 * MenuScale, y, "Invert mouse Y-axis:")
					InvertMouse = DrawTick(x + 310 * MenuScale, y + MenuScale, InvertMouse)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"mouseinvert")
					EndIf
					
					y = y + 40*MenuScale
					
					MouseSmooth = (SlideBar(x + 310*MenuScale, y-4*MenuScale, 150*MenuScale, (MouseSmooth)*50.0)/50.0)
					Color(255, 255, 255)
					AAText(x + 20 * MenuScale, y, "Mouse smoothing:")
					If MouseOn(x+310*MenuScale,y-4*MenuScale,150*MenuScale+14,20)
						DrawOptionsTooltip(tx,ty,tw,th,"mousesmoothing",MouseSmooth)
					EndIf
					
					Color(255, 255, 255)
					
					y = y + 30*MenuScale
					AAText(x + 20 * MenuScale, y, "Control configuration:")
					y = y + 10*MenuScale
					
					AAText(x + 20 * MenuScale, y + 20 * MenuScale, "Move Forward")
					InputBox(x + 160 * MenuScale, y + 20 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_UP,210)),5)		
					AAText(x + 20 * MenuScale, y + 40 * MenuScale, "Strafe Left")
					InputBox(x + 160 * MenuScale, y + 40 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_LEFT,210)),3)	
					AAText(x + 20 * MenuScale, y + 60 * MenuScale, "Move Backward")
					InputBox(x + 160 * MenuScale, y + 60 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_DOWN,210)),6)				
					AAText(x + 20 * MenuScale, y + 80 * MenuScale, "Strafe Right")
					InputBox(x + 160 * MenuScale, y + 80 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_RIGHT,210)),4)	
					AAText(x + 20 * MenuScale, y + 100 * MenuScale, "Quick Save")
					InputBox(x + 160 * MenuScale, y + 100 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_SAVE,210)),11)
					
					AAText(x + 280 * MenuScale, y + 20 * MenuScale, "Manual Blink")
					InputBox(x + 470 * MenuScale, y + 20 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_BLINK,210)),7)				
					AAText(x + 280 * MenuScale, y + 40 * MenuScale, "Sprint")
					InputBox(x + 470 * MenuScale, y + 40 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_SPRINT,210)),8)
					AAText(x + 280 * MenuScale, y + 60 * MenuScale, "Open/Close Inventory")
					InputBox(x + 470 * MenuScale, y + 60 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_INV,210)),9)
					AAText(x + 280 * MenuScale, y + 80 * MenuScale, "Crouch")
					InputBox(x + 470 * MenuScale, y + 80 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_CROUCH,210)),10)	
					AAText(x + 280 * MenuScale, y + 100 * MenuScale, "Open/Close Console")
					InputBox(x + 470 * MenuScale, y + 100 * MenuScale,100*MenuScale,20*MenuScale,KeyName(Min(KEY_CONSOLE,210)),12)
					
					If MouseOn(x+20*MenuScale,y,width-40*MenuScale,120*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"controls")
					EndIf
					
					For i = 0 To 227
						If KeyHit(i) Then key = i : Exit
					Next
					If key<>0 Then
						Select SelectedInputBox
							Case 3
								KEY_LEFT = key
							Case 4
								KEY_RIGHT = key
							Case 5
								KEY_UP = key
							Case 6
								KEY_DOWN = key
							Case 7
								KEY_BLINK = key
							Case 8
								KEY_SPRINT = key
							Case 9
								KEY_INV = key
							Case 10
								KEY_CROUCH = key
							Case 11
								KEY_SAVE = key
							Case 12
								KEY_CONSOLE = key
						End Select
						SelectedInputBox = 0
					EndIf
					;[End Block]
				ElseIf MainMenuTab = 7 ;Advanced
					;[Block]
					height = 320 * MenuScale
					DrawFrame(x, y, width, height)	
					
					y = y + 20*MenuScale
					
					Color 255,255,255				
					AAText(x + 20 * MenuScale, y, "Show HUD:")	
					HUDenabled = DrawTick(x + 310 * MenuScale, y + MenuScale, HUDenabled)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"hud")
					EndIf
					
					y=y+30*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Enable console:")
					CanOpenConsole = DrawTick(x + 310 * MenuScale, y + MenuScale, CanOpenConsole)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"consoleenable")
					EndIf
					
					y = y + 30*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Open console on error:")
					ConsoleOpening = DrawTick(x + 310 * MenuScale, y + MenuScale, ConsoleOpening)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"consoleerror")
					EndIf
					
					y = y + 50*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Achievement popups:")
					AchvMSGenabled% = DrawTick(x + 310 * MenuScale, y + MenuScale, AchvMSGenabled%)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"achpopup")
					EndIf
					
					y = y + 50*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Show FPS:")
					ShowFPS% = DrawTick(x + 310 * MenuScale, y + MenuScale, ShowFPS%)
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"showfps")
					EndIf
					
					y = y + 30*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Framelimit:")
					Color 255,255,255
					If DrawTick(x + 310 * MenuScale, y, CurrFrameLimit > 0.0) Then
						;CurrFrameLimit# = (SlideBar(x + 150*MenuScale, y+30*MenuScale, 100*MenuScale, CurrFrameLimit#*50.0)/50.0)
						;CurrFrameLimit = Max(CurrFrameLimit, 0.1)
						;Framelimit% = CurrFrameLimit#*100.0
						CurrFrameLimit# = (SlideBar(x + 150*MenuScale, y+30*MenuScale, 100*MenuScale, CurrFrameLimit#*99.0)/99.0)
						CurrFrameLimit# = Max(CurrFrameLimit, 0.01)
						Framelimit% = 19+(CurrFrameLimit*100.0)
						Color 255,255,0
						AAText(x + 25 * MenuScale, y + 25 * MenuScale, Framelimit%+" FPS")
					Else
						CurrFrameLimit# = 0.0
						Framelimit = 0
					EndIf
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"framelimit",Framelimit)
					EndIf
					If MouseOn(x+150*MenuScale,y+30*MenuScale,100*MenuScale+14,20)
						DrawOptionsTooltip(tx,ty,tw,th,"framelimit",Framelimit)
					EndIf
					
					y = y + 80*MenuScale
					
					Color 255,255,255
					AAText(x + 20 * MenuScale, y, "Antialiased text:")
					AATextEnable% = DrawTick(x + 310 * MenuScale, y + MenuScale, AATextEnable%)
					If AATextEnable_Prev% <> AATextEnable
						For font.AAFont = Each AAFont
							FreeFont font\lowResFont%
							If (Not AATextEnable)
								FreeTexture font\texture
								FreeImage font\backup
							EndIf
							Delete font
						Next
						If (Not AATextEnable) Then
							FreeEntity AATextCam
							;For i%=0 To 149
							;	FreeEntity AATextSprite[i]
							;Next
						EndIf
						InitAAFont()
						Font1% = AALoadFont("GFX\font\cour\Courier New.ttf", Int(18 * (GraphicHeight / 1024.0)), 0,0,0)
						Font2% = AALoadFont("GFX\font\courbd\Courier New.ttf", Int(58 * (GraphicHeight / 1024.0)), 0,0,0)
						Font3% = AALoadFont("GFX\font\DS-DIGI\DS-Digital.ttf", Int(22 * (GraphicHeight / 1024.0)), 0,0,0)
						Font4% = AALoadFont("GFX\font\DS-DIGI\DS-Digital.ttf", Int(60 * (GraphicHeight / 1024.0)), 0,0,0)
						Font5% = AALoadFont("GFX\font\Journal\Journal.ttf", Int(58 * (GraphicHeight / 1024.0)), 0,0,0)
						ConsoleFont% = AALoadFont("Blitz", Int(22 * (GraphicHeight / 1024.0)), 0,0,0,1)
						;ReloadAAFont()
						AATextEnable_Prev% = AATextEnable
					EndIf
					If MouseOn(x+310*MenuScale,y+MenuScale,20*MenuScale,20*MenuScale)
						DrawOptionsTooltip(tx,ty,tw,th,"antialiastext")
					EndIf
					;[End Block]
				EndIf
				;[End Block]
			Case 4 ; load map
				;[Block]
				y = y + height + 20 * MenuScale
				width = 580 * MenuScale
				height = 510 * MenuScale
				
				DrawFrame(x, y, width, height)
				
				x = 159 * MenuScale
				y = 286 * MenuScale
				
				width = 400 * MenuScale
				height = 70 * MenuScale
				
				Color(255, 255, 255)
				AASetFont Font2
				AAText(x + width / 2, y + height / 2, "LOAD MAP", True, True)
				
				x = 160 * MenuScale
				y = y + height + 20 * MenuScale
				width = 580 * MenuScale
				height = 350 * MenuScale
				
				AASetFont Font2
				
				tx# = x+width
				ty# = y
				tw# = 400*MenuScale
				th# = 150*MenuScale
				
				If CurrLoadGamePage < Ceil(Float(SavedMapsAmount)/6.0)-1 Then 
					If DrawButton(x+530*MenuScale, y + 510*MenuScale, 50*MenuScale, 55*MenuScale, ">") Then
						CurrLoadGamePage = CurrLoadGamePage+1
					EndIf
				Else
					DrawFrame(x+530*MenuScale, y + 510*MenuScale, 50*MenuScale, 55*MenuScale)
					Color(100, 100, 100)
					AAText(x+555*MenuScale, y + 537.5*MenuScale, ">", True, True)
				EndIf
				If CurrLoadGamePage > 0 Then
					If DrawButton(x, y + 510*MenuScale, 50*MenuScale, 55*MenuScale, "<") Then
						CurrLoadGamePage = CurrLoadGamePage-1
					EndIf
				Else
					DrawFrame(x, y + 510*MenuScale, 50*MenuScale, 55*MenuScale)
					Color(100, 100, 100)
					AAText(x+25*MenuScale, y + 537.5*MenuScale, "<", True, True)
				EndIf
				
				DrawFrame(x+50*MenuScale,y+510*MenuScale,width-100*MenuScale,55*MenuScale)
				
				AAText(x+(width/2.0),y+536*MenuScale,"Page "+Int(Max((CurrLoadGamePage+1),1))+"/"+Int(Max((Int(Ceil(Float(SavedMapsAmount)/6.0))),1)),True,True)
				
				AASetFont Font1
				
				If CurrLoadGamePage > Ceil(Float(SavedMapsAmount)/6.0)-1 Then
					CurrLoadGamePage = CurrLoadGamePage - 1
				EndIf
				
				AASetFont Font1
				
				If SavedMaps(0)="" Then 
					AAText (x + 20 * MenuScale, y + 20 * MenuScale, "No saved maps. Use the Map Creator to create new maps.")
				Else
					x = x + 20 * MenuScale
					y = y + 20 * MenuScale
					For i = (1+(6*CurrLoadGamePage)) To 6+(6*CurrLoadGamePage)
						If i <= SavedMapsAmount Then
							DrawFrame(x,y,540* MenuScale, 70* MenuScale)
							
							AAText(x + 20 * MenuScale, y + 10 * MenuScale, SavedMaps(i - 1))
							AAText(x + 20 * MenuScale, y + (10+27) * MenuScale, SavedMapsAuthor(i - 1))
							
							If DrawButton(x + 400 * MenuScale, y + 20 * MenuScale, 100 * MenuScale, 30 * MenuScale, "Load", False) Then
								SelectedMap=SavedMaps(i - 1)
								MainMenuTab = 1
							EndIf
							If MouseOn(x + 400 * MenuScale, y + 20 * MenuScale, 100*MenuScale,30*MenuScale)
								DrawMapCreatorTooltip(tx,ty,tw,th,SavedMaps(i-1))
							EndIf
							
							y = y + 80 * MenuScale
						Else
							Exit
						EndIf
					Next
				EndIf
				;[End Block]
		End Select
		
	End If
	
	Color 255,255,255
	AASetFont ConsoleFont
	AAText 20,GraphicHeight-30,"v"+VersionNumber
	
	;DrawTiledImageRect(MenuBack, 985 * MenuScale, 860 * MenuScale, 200 * MenuScale, 20 * MenuScale, 1200 * MenuScale, 866 * MenuScale, 300, 20 * MenuScale)
	
	If Fullscreen Then DrawImage CursorIMG, ScaledMouseX(),ScaledMouseY()
	
	AASetFont Font1
End Function

Function UpdateLauncher()
	MenuScale = 1
	
	Graphics3DExt(LauncherWidth, LauncherHeight, 0, 2)

	;InitExt
	
	SetBuffer BackBuffer()
	
	RealGraphicWidth = GraphicWidth
	RealGraphicHeight = GraphicHeight
	
	Font1 = LoadFont_Strict("GFX\font\cour\Courier New.ttf", 18, 0,0,0)
	SetFont Font1
	MenuWhite = LoadImage_Strict("GFX\menu\menuwhite.jpg")
	MenuBlack = LoadImage_Strict("GFX\menu\menublack.jpg")	
	MaskImage MenuBlack, 255,255,0
	LauncherIMG = LoadImage_Strict("GFX\menu\launcher.jpg")
	ButtonSFX% = LoadSound_Strict("SFX\Interact\Button.ogg")
	Local i%	
	
	For i = 0 To 3
		ArrowIMG(i) = LoadImage_Strict("GFX\menu\arrow.png")
		RotateImage(ArrowIMG(i), 90 * i)
		HandleImage(ArrowIMG(i), 0, 0)
	Next
	
	For i% = 1 To TotalGFXModes
		Local samefound% = False
		For  n% = 0 To TotalGFXModes - 1
			If GfxModeWidths(n) = GfxModeWidth(i) And GfxModeHeights(n) = GfxModeHeight(i) Then samefound = True : Exit
		Next
		If samefound = False Then
			If GraphicWidth = GfxModeWidth(i) And GraphicHeight = GfxModeHeight(i) Then SelectedGFXMode = GFXModes
			GfxModeWidths(GFXModes) = GfxModeWidth(i)
			GfxModeHeights(GFXModes) = GfxModeHeight(i)
			GFXModes=GFXModes+1 
		End If
	Next
	
	BlinkMeterIMG% = LoadImage_Strict("GFX\blinkmeter.jpg")
	CheckForUpdates()
	
	AppTitle "SCP - Containment Breach Launcher"
	
	Repeat
		
		;Cls
		Color 0,0,0
		Rect 0,0,LauncherWidth,LauncherHeight,True
		
		MouseHit1 = MouseHit(1)
		
		Color 255, 255, 255
		DrawImage(LauncherIMG, 0, 0)
		
		Text(20, 240 - 65, "Resolution: ")
		
		Local x% = 40
		Local y% = 270 - 65
		For i = 0 To (GFXModes - 1)
			Color 0, 0, 0
			If SelectedGFXMode = i Then Rect(x - 1, y - 1, 100, 20, False)
			
			Text(x, y, (GfxModeWidths(i) + "x" + GfxModeHeights(i)))
			If MouseOn(x - 1, y - 1, 100, 20) Then
				Color 100, 100, 100
				Rect(x - 1, y - 1, 100, 20, False)
				If MouseHit1 Then SelectedGFXMode = i
			EndIf
			
			y=y+20
			If y >= 250 - 65 + (LauncherHeight - 80 - 260) Then y = 270 - 65 : x=x+100
		Next
		
		;-----------------------------------------------------------------
		Color 255, 255, 255
		x = 30
		y = 369
		Rect(x - 10, y, 340, 95)
		Text(x - 10, y - 25, "Graphics:")
		
		y=y+10
		For i = 1 To CountGfxDrivers()
			Color 0, 0, 0
			If SelectedGFXDriver = i Then Rect(x - 1, y - 1, 290, 20, False)
			;text(x, y, bbGfxDriverName(i))
			LimitText(GfxDriverName(i), x, y, 290, False)
			If MouseOn(x - 1, y - 1, 290, 20) Then
				Color 100, 100, 100
				Rect(x - 1, y - 1, 290, 20, False)
				If MouseHit1 Then SelectedGFXDriver = i
			EndIf
			
			y=y+20
		Next
		
		Fullscreen = DrawTick(40 + 430 - 15, 260 - 55 + 5 - 8, Fullscreen, BorderlessWindowed)
		BorderlessWindowed = DrawTick(40 + 430 - 15, 260 - 55 + 35, BorderlessWindowed)
		lock% = False

		If BorderlessWindowed Or (Not Fullscreen) Then lock% = True
		Bit16Mode = DrawTick(40 + 430 - 15, 260 - 55 + 65 + 8, Bit16Mode,lock%)
		LauncherEnabled = DrawTick(40 + 430 - 15, 260 - 55 + 95 + 8, LauncherEnabled)

		If BorderlessWindowed
 		   Color 255, 0, 0
 		   Fullscreen = False
		Else
  		  Color 255, 255, 255
		EndIf

		Text(40 + 430 + 15, 262 - 55 + 5 - 8, "Fullscreen")
		Color 255, 255, 255
		Text(40 + 430 + 15, 262 - 55 + 35 - 8, "Borderless",False,False)
		Text(40 + 430 + 15, 262 - 55 + 35 + 12, "windowed mode",False,False)

		If BorderlessWindowed Or (Not Fullscreen)
 		   Color 255, 0, 0
 		   Bit16Mode = False
		Else
		    Color 255, 255, 255
		EndIf

		Text(40 + 430 + 15, 262 - 55 + 65 + 8, "16 Bit")
		Color 255, 255, 255
		Text(40 + 430 + 15, 262 - 55 + 95 + 8, "Use launcher")
		
		If (Not BorderlessWindowed)
			If Fullscreen
				Text(40+ 260 + 15, 262 - 55 + 140, "Current Resolution: "+(GfxModeWidths(SelectedGFXMode) + "x" + GfxModeHeights(SelectedGFXMode) + "," + (16+(16*(Not Bit16Mode)))))
			Else
				Text(40+ 260 + 15, 262 - 55 + 140, "Current Resolution: "+(GfxModeWidths(SelectedGFXMode) + "x" + GfxModeHeights(SelectedGFXMode) + ",32"))
			EndIf
		Else
			Text(40+ 260 + 15, 262 - 55 + 140, "Current Resolution: "+GfxModeWidths(SelectedGFXMode) + "x" + GfxModeHeights(SelectedGFXMode) + ",32")
			If GfxModeWidths(SelectedGFXMode)<G_viewport_width Then
				Text(40+ 260 + 65, 262 - 55 + 160, "(upscaled to")
				Text(40+ 260 + 65, 262 - 55 + 180, G_viewport_width + "x" + G_viewport_height + ",32)")
			ElseIf GfxModeWidths(SelectedGFXMode)>G_viewport_width Then
				Text(40+ 260 + 65, 262 - 55 + 160, "(downscaled to")
				Text(40+ 260 + 65, 262 - 55 + 180, G_viewport_width + "x" + G_viewport_height + ",32)")
			EndIf
		EndIf
		
		UpdateCheckEnabled = DrawTick(LauncherWidth - 275, LauncherHeight - 50, UpdateCheckEnabled)
		Color 255,255,255
		Text LauncherWidth-250,LauncherHeight-70,"Check for"
		Text LauncherWidth-250,LauncherHeight-50,"updates on"
		Text LauncherWidth-250,LauncherHeight-30,"launch"
		
		If DrawButton(LauncherWidth - 30 - 90, LauncherHeight - 50 - 55, 100, 30, "LAUNCH", False, False, False) Then
			GraphicWidth = GfxModeWidths(SelectedGFXMode)
			GraphicHeight = GfxModeHeights(SelectedGFXMode)
			RealGraphicWidth = GraphicWidth
			RealGraphicHeight = GraphicHeight
			Exit
		EndIf
		
		If DrawButton(LauncherWidth - 30 - 90, LauncherHeight - 50, 100, 30, "EXIT", False, False, False) Then End
		Flip
	Forever
	
	PutINIValue(OptionFile, "options", "width", GfxModeWidths(SelectedGFXMode))
	PutINIValue(OptionFile, "options", "height", GfxModeHeights(SelectedGFXMode))
	If Fullscreen Then
		PutINIValue(OptionFile, "options", "fullscreen", "true")
	Else
		PutINIValue(OptionFile, "options", "fullscreen", "false")
	EndIf
	If LauncherEnabled Then
		PutINIValue(OptionFile, "launcher", "launcher enabled", "true")
	Else
		PutINIValue(OptionFile, "launcher", "launcher enabled", "false")
	EndIf
	If BorderlessWindowed Then
		PutINIValue(OptionFile, "options", "borderless windowed", "true")
	Else
		PutINIValue(OptionFile, "options", "borderless windowed", "false")
	EndIf
	If Bit16Mode Then
		PutINIValue(OptionFile, "options", "16bit", "true")
	Else
		PutINIValue(OptionFile, "options", "16bit", "false")
	EndIf
	PutINIValue(OptionFile, "options", "gfx driver", SelectedGFXDriver)
	If UpdateCheckEnabled Then
		PutINIValue(OptionFile, "options", "check for updates", "true")
	Else
		PutINIValue(OptionFile, "options", "check for updates", "false")
	EndIf
	
End Function


Function DrawTiledImageRect(img%, srcX%, srcY%, srcwidth#, srcheight#, x%, y%, width%, height%)
	
	Local x2% = x
	While x2 < x+width
		Local y2% = y
		While y2 < y+height
			If x2 + srcwidth > x + width Then srcwidth = srcwidth - Max((x2 + srcwidth) - (x + width), 1)
			If y2 + srcheight > y + height Then srcheight = srcheight - Max((y2 + srcheight) - (y + height), 1)
			DrawImageRect(img, x2, y2, srcX, srcY, srcwidth, srcheight)
			y2 = y2 + srcheight
		Wend
		x2 = x2 + srcwidth
	Wend
	
End Function



Type LoadingScreens
	Field imgpath$
	Field img%
	Field ID%
	Field title$
	Field alignx%, aligny%
	Field disablebackground%
	Field txt$[5], txtamount%
End Type

Function InitLoadingScreens(file$)
	Local TemporaryString$, i%
	Local ls.LoadingScreens
	
	Local f = OpenFile(file)
	
	While Not Eof(f)
		TemporaryString = Trim(ReadLine(f))
		If Left(TemporaryString,1) = "[" Then
			TemporaryString = Mid(TemporaryString, 2, Len(TemporaryString) - 2)
			
			ls.LoadingScreens = New LoadingScreens
			LoadingScreenAmount=LoadingScreenAmount+1
			ls\ID = LoadingScreenAmount
			
			ls\title = TemporaryString
			ls\imgpath = GetINIString(file, TemporaryString, "image path")
			
			For i = 0 To 4
				ls\txt[i] = GetINIString(file, TemporaryString, "text"+(i+1))
				If ls\txt[i]<> "" Then ls\txtamount=ls\txtamount+1
			Next
			
			ls\disablebackground = GetINIInt(file, TemporaryString, "disablebackground")
			
			Select Lower(GetINIString(file, TemporaryString, "align x"))
				Case "left"
					ls\alignx = -1
				Case "middle", "center"
					ls\alignx = 0
				Case "right" 
					ls\alignx = 1
			End Select 
			
			Select Lower(GetINIString(file, TemporaryString, "align y"))
				Case "top", "up"
					ls\aligny = -1
				Case "middle", "center"
					ls\aligny = 0
				Case "bottom", "down"
					ls\aligny = 1
			End Select 			
			
		EndIf
	Wend
	
	CloseFile f
End Function



Function DrawLoading(percent%, shortloading=False)
	
	Local x%, y%
