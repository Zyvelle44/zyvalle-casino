var UHTLogotypeInfo = {
    "ext_test3": {"src": "oneworks_logo.png", "bg": "#000000", "fit": "shrink"},
    "oneworks": {"src": "oneworks_logo.png", "bg": "#000000", "fit": "shrink"},
	"ow_cash": {"src": "oneworks_logo.png", "bg": "#000000", "fit": "shrink"}
};

var UHTLobbySeparateIcons = {
	"zh" : "_zh/",
	"zt" : "_zh/"
}

UHT_ForceClickForSounds = true;
UHT_STILLCHECKMONEYONSPIN = true;

var SPIN_TRACKER_ID = Math.floor(Math.random() * 32);
ga('create', 'UA-83294317-' + (7 + SPIN_TRACKER_ID), {'siteSpeedSampleRate':  10, 'sampleRate':   1, name: "ST" + SPIN_TRACKER_ID});

function UHTPatch(info) // {name, ready(), apply(), interval}
{
	if (info["_UHT_timer"] != undefined)
		clearTimeout(info["_UHT_timer"]);
	if (info.ready())
		info.apply();
	else
		if (info.retry())
			info["_UHT_timer"] = setTimeout(function(){UHTPatch(info)}, info.interval || 500);
}

UHTPatch({
	name: "PatchRC_CheckShowWindow",
	ready:function()
	{
		return (window["RC_CheckShowWindow"] != undefined);
	},
	apply:function()
	{
		RC_CheckShowWindow = function()
		{
			if (RC_timer == -1)
				return;
			if (UHT_GAME_CONFIG["rcSettings"] == null)
				return;
			if (UHT_GAME_CONFIG["rcSettings"]["rctype"] != "RC0")
				return;
			if (IsRequired("RCEA") && (UHT_GAME_CONFIG["rcSettings"]["elapsed"] > UHT_GAME_CONFIG["rcSettings"]["interval"]))
				UHT_GAME_CONFIG["rcSettings"]["elapsed"] -= UHT_GAME_CONFIG["rcSettings"]["interval"];
			if (RC_WindowShown)
				return;
			var now = (new Date).getTime();
			var interval = UHT_GAME_CONFIG["rcSettings"]["interval"];
			var minutes_passed = ((now - RC_timer) / 6E4) + (UHT_GAME_CONFIG["rcSettings"]["elapsed"] || 0);
			var all_minutes_passed = Math.floor((now - RC_sessionTimer) / 6E4) | 0;
			if (minutes_passed >= interval) {
				SystemMessageManager.ShowMessage(SystemMessageType.ClientRegulation, false, UHT_GAME_CONFIG["rcSettings"]["msg"].replace("{0}", interval.toString()).replace("{1}", all_minutes_passed));
				UHT_GAME_CONFIG["rcSettings"]["elapsed"] = 0;
				RC_WindowShown = true
			}
		}
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchFRBEV",
	ready:function()
	{
		return (window["XT"] != undefined && window["XT"]["RegisterAndInitDone"]);
	},
	apply:function()
	{
		var isStart = false;
		var SendFRBEvent = function()
		{
			if (isStart)
				UHTInterfaceBOSS.PostMessage("FRB_STARTED");
			else
				UHTInterfaceBOSS.PostMessage("FRB_ENDED");
		}

		if (IsRequired("FRBEVS"))
		{
			var PrepareToSendStartEvent = function()
			{
				isStart = true;
			};

			if (Vars.Evt_DataToCode_BonusRoundsOnContinuePressed)
				XT.RegisterCallbackEvent(Vars.Evt_DataToCode_BonusRoundsOnContinuePressed, SendFRBEvent, this);
			if (Vars.Evt_CodeToData_BonusRoundsStarted)
				XT.RegisterCallbackEvent(Vars.Evt_CodeToData_BonusRoundsStarted, PrepareToSendStartEvent, this);
			if (Vars.Evt_CodeToData_TimedBonusRoundsStarted)
				XT.RegisterCallbackEvent(Vars.Evt_CodeToData_TimedBonusRoundsStarted, PrepareToSendStartEvent, this);
		}

		if (IsRequired("FRBEVE"))
		{
			var PrepareToSendEndEvent = function()
			{
				isStart = false;
			};

			if (Vars.Evt_DataToCode_BonusRoundsOnContinuePressed)
				XT.RegisterCallbackEvent(Vars.Evt_DataToCode_BonusRoundsOnContinuePressed, SendFRBEvent, this);
			if (Vars.Evt_CodeToData_BonusRoundsFinished)
				XT.RegisterCallbackEvent(Vars.Evt_CodeToData_BonusRoundsFinished, PrepareToSendEndEvent, this);
			if (Vars.Evt_CodeToData_TimedBonusRoundsFinished)
				XT.RegisterCallbackEvent(Vars.Evt_CodeToData_TimedBonusRoundsFinished, PrepareToSendEndEvent, this);
		}
	},
	retry:function()
	{
		return (window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"]);
	}
});

UHTPatch({
	name: "PatchJurisdictionRequirementsOnGP16",
	ready:function()
	{
		return (window["VideoSlotsConnectionXTLayer"] != undefined && window["UHT_GAME_CONFIG_SRC"] != undefined);
	},
	apply:function()
	{
		if (location.hostname.indexOf(".gp16.") == -1)
			return;

		if (window["UHT_GAME_CONFIG"].STYLENAME != "ext_test1")
			return;

		var url = window.location.href;
		var data = null;
		if (url.indexOf("brandName") != -1)
		{
			var params = url.split("&");
			for (var i = 0; i < params.length; i++)
			{
				if (params[i].indexOf("brandName") == 0)
				{
					data = params[i].split("=")[1];
				}
			}
		}
		else 
			return;

		window["UHT_GAME_CONFIG_SRC"].jurisdictionRequirements += "," + data;
		var oVSCXTL_RS = VideoSlotsConnectionXTLayer.prototype.RequirementsSetup;
		VideoSlotsConnectionXTLayer.prototype.RequirementsSetup = function ()
		{
			ServerOptions.brandRequirements += "," + data;
			oVSCXTL_RS.apply(this, arguments);
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchSlider",
	ready:function()
	{
		return (window["Slider"] != undefined);
	},
	apply:function()
	{
		Slider.prototype.Autocomplete = function()
		{
			if (this.autocomplete)
			{
				if (this.type == SliderType.Bool)
				{
					var targetValue = this.internalValue >= 0.5 ? 1 : 0;
					var value = UHTMath.inverseLerp(this.thumb.localPositionLimitMin.x, this.thumb.localPositionLimitMax.x, this.thumb.target.localPosition().x);

					if (targetValue != value)
					{
						this.animator.manualTo = this.internalValue >= 0.5 ? this.thumb.localPositionLimitMax : this.thumb.localPositionLimitMin;
						this.animator.animationTime = this.animationTime * Math.abs(targetValue - value);
						this.animator.Play();
					}
				}
			}

			this.autocompleteFrameCount = Time.frameCount;
		};
		
		Slider.prototype.InverseAutocomplete = function()
		{
			if (this.autocomplete && this.autocompleteFrameCount != Time.frameCount)
			{
				if (this.type == SliderType.Bool)
				{
					var targetValue = this.internalValue >= 0.5 ? 0 : 1;
					var value = UHTMath.inverseLerp(this.thumb.localPositionLimitMin.x, this.thumb.localPositionLimitMax.x, this.thumb.target.localPosition().x);

					if (targetValue != value)
					{
						this.animator.manualTo = targetValue == 1 ? this.thumb.localPositionLimitMax : this.thumb.localPositionLimitMin;
						this.animator.animationTime = this.inverseAnimationTime * Math.abs(targetValue - value);
						this.animator.Play();
					}
				}
			}
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchWalletAwareSB",
	ready:function()
	{
		return (window["RequestManager"] != undefined && window["RequestManager"].MustLimitSpinRequest != undefined);
	},
	apply:function()
	{
		if (IsRequired("WASB"))
		{
			var oRMMLSR = RequestManager.MustLimitSpinRequest;
			RequestManager.MustLimitSpinRequest = function()
			{
				XT.SetFloat(Vars.SpinDuration, 0);
				return oRMMLSR.apply(this, arguments);
			}
		};
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchAGCC_73839",
	ready:function()
	{
		return (window["AGCCController"] != undefined);
	},
	apply:function()
	{
		AGCCController.prototype.Update = function()
		{
			if (UHT_GAME_CONFIG != null)
			{
				this.shouldShow = UHT_GAME_CONFIG["jurisdictionMsg"] == "imageAGCC";
				this.image.SetActive(this.shouldShow);
			}

			if (this.shouldShow)
			{
				var myCamera = Globals.GetCameraForObject(this.image);
				if (myCamera != null)
				{
					var posOnScreen = new UHTMath.Vector3(0, 0, 0);
					posOnScreen.y = UHTScreen.height;
					var posOnWorld = myCamera.ScreenToWorldPoint(posOnScreen);
					var pos = this.image.transform.position();
					this.image.transform.position(pos.x, posOnWorld.y + 0.05, pos.z);
				}

				if (UHTScreen.width >= UHTScreen.height * 1.4)
				{
					this.image.transform.localScale(2.1, 2.1, 2.1);
				}
				else if (UHTScreen.width >= UHTScreen.height)
				{
					this.image.transform.localScale(1.7, 1.7, 1.7);
				}
				else if (UHTScreen.width < UHTScreen.height)
				{
					this.image.transform.localScale(1.05, 1.05, 1.05);
				}

				var clientLoader = globalRuntime.sceneRoots[0].GetComponentsInChildren(ClientLoader)[0];
				clientLoader.transform.localScale(0.6, 0.6, 0.6);
				clientLoader.transform.localPosition(0, 30, 0);
			}
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchSplitResponseContent",
	ready:function()
	{
		return (window["GameProtocolCommonParser"] != undefined);
	},
	apply:function()
	{
		GameProtocolCommonParser.SplitResponseContent = function(nameValues)
		{
			var mapNameValues = {};
			for (var i = 0; i < nameValues.length; ++i)
			{
				var nameValueSplitted = nameValues[i].split('=', 2);
				if (nameValueSplitted.length == 2)
				{
					nameValueSplitted[1] = nameValues[i].split("=").slice(1).join("=");
					if (mapNameValues[nameValueSplitted[0]] == undefined)
						mapNameValues[nameValueSplitted[0]] = nameValueSplitted[1];
				}
			}
			return mapNameValues;
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchBonusBalanceEvent",
	ready:function()
	{
		return (window["VideoSlotsConnectionXTLayer"] != undefined && window["VSProtocolParser"].ParseVsResponse != undefined);
	},
	apply:function()
	{
		if (window["UHTInterfaceBOSS"].enabled && window.top != window)
		{
			var hadBonusBalance = undefined;
			var oPVR = VSProtocolParser.ParseVsResponse;
			VSProtocolParser.ParseVsResponse = function()
			{
				var hasBonusBalance = (arguments[0].balance_bonus > 0);
				if ((hasBonusBalance && hadBonusBalance!=true) || (!hasBonusBalance && hadBonusBalance!=false))
				{
					var msg = "";
					if (hasBonusBalance)
						msg = "bonusBalanceAvailable";
					if (!hasBonusBalance)
						msg = "bonusBalanceUnavailable";
					
					hadBonusBalance=hasBonusBalance;
					
					var args =
					{
						sender: URLGameSymbol,
						lang: UHT_GAME_CONFIG["LANGUAGE"].toUpperCase(),
						success: true,
						name: msg,
						event: msg
					}
					
					UHTInterfaceBOSS.PostMessageRec(window.parent, args);
				}
				return oPVR.apply(this, arguments);
			}
		};
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});


UHTPatch({
	name: "PatchGameHistoryEvent",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1 && window["UHT_GAME_CONFIG_SRC"] != undefined);
	},
	apply:function()
	{
		if (IsRequired("GHEV"))
		{
			UHTInterfaceBOSS.HandleGameHistory = function()
			{
				UHTInterfaceBOSS.PostMessage("OPEN_HISTORY");
				return true;
			};
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});


UHTPatch({
	name: "PatchHideGameHistory",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1 && window["UHT_GAME_CONFIG_SRC"] != undefined);
	},
	apply:function()
	{
		if (IsRequired("NOGH"))
		{
			var gameHistoryButtons = globalRuntime.sceneRoots[1].GetComponentsInChildren(GameHistoryButton, true);
			for (var i = 0; i < gameHistoryButtons.length; i++)
			{
				gameHistoryButtons[i].gameObject.SetActive(false);
			}
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});


UHTPatch({
	name: "PatchRealityCheckEvents",
	ready:function()
	{
		return (window["SystemMessageManager"] != undefined) && (window["SystemMessageManager"]["RCClose"] != undefined) 
			&& (window["SystemMessageManager"]["RCContinue"] != undefined) && (window["SystemMessageManager"]["ShowMessage"] != undefined);
	},
	apply:function()
	{
		var oSMMRCContinue = SystemMessageManager.RCContinue;
		SystemMessageManager.RCContinue = function()
		{
			UHTInterfaceBOSS.PostMessage("RC_CONTINUE");
			oSMMRCContinue.apply(this, arguments);
		}

		var oSMMRCClose = SystemMessageManager.RCClose;
		SystemMessageManager.RCClose = function()
		{
			UHTInterfaceBOSS.PostMessage("RC_QUIT");
			oSMMRCClose.apply(this, arguments);
		}

		var oSMMShowMessage = SystemMessageManager.ShowMessage;
		SystemMessageManager.ShowMessage = function(type, unlogged, text, args, customMsg)
		{
			if (type == SystemMessageType.ClientRegulation)
				UHTInterfaceBOSS.PostMessage("RC_SHOWN");

			oSMMShowMessage.apply(this, arguments);
		}

	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchHideCurrency",
	ready:function()
	{
		return (window["Adapter"] != undefined);
	},
	apply:function()
	{
		if (IsRequired("NOCUR"))
		{
			var oA_HGC = Adapter.prototype.HandleGetConfiguration;
			Adapter.prototype.HandleGetConfiguration = function ()
			{
				oA_HGC.apply(this, arguments);
				ServerOptions.currency = "GNR";
			};
		}
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchDisableHomeButtonMobile",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && (window["globalRuntime"].sceneRoots.length > 1) && window["UHT_GAME_CONFIG_SRC"] != undefined);
	},
	apply:function()
	{
		var shouldDisable = false;
		var styleNameList = "wkl_wynn383,wkl_mxm,396_ao99,oryxsw_zlatnik,btsn_supercasino,btsn_jackpot247,btsn_casinoeuro,btsn_jallacasino,btsn_liveroulette,btsn_mobilbahis,btsn_betsafe,btsn_betsafeee,btsn_betsafelv,btsn_betsafede,btsn_betsafese,btsn_betsson,btsn_betssones,btsn_betssongr,btsn_betssonde,btsn_betssonse,btsn_casinodk,btsn_europebet,btsn_nordicbet,btsn_nordicbetdk,btsn_nordicbetde,btsn_nordicbetse".split(",");
		for (var i = 0; i < styleNameList.length; i++)
		{
			if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
			{
				shouldDisable = true;
				break;
			}
		}

		if (UHT_GAME_CONFIG.STYLENAME.indexOf("weinet_") > -1)
			shouldDisable = true;

		if (UHT_GAME_CONFIG.STYLENAME.indexOf("ggn_") > -1)
			shouldDisable = true;

		if (IsRequired("NOHB"))
			shouldDisable = true;

		if (shouldDisable)
		{
			if (Globals.isMobile)
			{
				var OnNotification = function(notification)
				{
					if (notification == null || notification.buttons == null)
						return;

					for (var i = 0; i < notification.buttons.length; i++)
					{
						if (notification.buttons[i].id == "BtCLOSE" || notification.buttons[i].action == "quit")
						{
							notification.buttons.splice(i, 1);
							break;
						}
					}
					XT.SetObject(CustomNotificationVars.CustomNotification, notification);
				}
				XT.RegisterCallbackObject(CustomNotificationVars.CustomNotification, OnNotification, this, -1);

				if (window["MenuWindowControllerMobile"] == undefined)
					return;
				var menus = globalRuntime.sceneRoots[1].GetComponentsInChildren(MenuWindowControllerMobile, true);
				for (var i = 0; i < menus.length; ++i)
				{
					var go = menus[i].transform.Find("Content/Home");
					if (go != null)
						go.gameObject.SetActive(false);
					else
					{
						menus[i].transform.Find("Content/Links/WithoutPromoUrl/Home").gameObject.SetActive(false);
						menus[i].transform.Find("Content/Links/WithPromoUrl/Home").gameObject.SetActive(false);
						go = menus[i].transform.Find("Content/Lines")
						if (go != null)
							go.gameObject.SetActive(false);
						go = menus[i].transform.Find("Content/Links/Lines")
						if (go != null)
							go.gameObject.SetActive(false);
					}
				}
				XT.SetBool(Vars.Jurisdiction_GameLobbyInfoVisible, false);
			}
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchTournamentConnectionRaceDetails",
	ready:function()
	{
		return window["TournamentConnection"] != undefined;
	},
	apply:function()
	{
		TournamentConnection.prototype.OnRaceDetailsReloaded = function(param, statusCode)
		{
			TournamentProtocol.TournamentParser.errorMessage = "PromoAPI Parsing Error (promo/race/details)";
			var response = TournamentProtocol.TournamentParser.ParseDetailsResponse(param);
			if (response == null || response.details == null)
			{
				this.Reload(this.raceDetailsURL, this.raceDetailsReloadedHandler);
				return;
			}

			for (var i = 0; i < response.details.length; ++i)
			{
				var item = this.FindPromoHolderInternal(response.details[i].id, TournamentProtocol.PromoType.Race);

				if (item.details == null)
				{
					item.details = response.details[i];
					this.isRacePrizesReloaded = false;
				}
				else
				{
					var _prizeList = item.details.prizePool.prizesList;
					item.details.prizePool = response.details[i].prizePool;
					item.details.prizePool.prizesList = _prizeList;
				}
				item.details.htmlRules = response.details[i].htmlRules;
				item.details.shortHtmlRules = response.details[i].shortHtmlRules;
				item.details.prizePoolTotal = response.details[i].prizePool;
				item.details.currencyRateMap = response.details[i].currencyRateMap;

				this.ConvertDetailsToPlayerCurrency(item);
				PromotionsHelper.ConvertDynamicFields(item.details);

				if (this.updateWinnerPrizesWhenDetailsReloaded)
					this.UpdateWinnerPrizes(item);
			}

			this.isReloaded = true;
			this.isRaceDetailsReloaded = true;
			this.updateWinnerPrizesWhenDetailsReloaded = false;
		};

		TournamentConnection.prototype.OnRacePrizesReloaded = function(param, statusCode)
		{
			this.racePrizesTimer = 0;
			this.isReloadindRacePrizes = false;

			TournamentProtocol.TournamentParser.errorMessage = "PromoAPI Parsing Error (promo/race/prizes)";
			var response = TournamentProtocol.TournamentParser.ParseDetailsResponse(param);
			if (response == null || response.details == null)
				return;

			for (var i = 0; i < response.details.length; ++i)
			{
				var item = this.FindPromoHolderInternal(response.details[i].id, TournamentProtocol.PromoType.Race);

				if (item.details == null)
					item.details = response.details[i];

				item.details.prizePool.prizesList = response.details[i].prizePool.prizesList;
				item.details.prizePool.totalCount = response.details[i].prizePool.totalCount;

				this.ConvertDetailsToPlayerCurrency(item);
				PromotionsHelper.ConvertDynamicFields(item.details);
			}

			this.isReloaded = true;
			this.isRacePrizesReloaded = true;
		};

	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchScrollableListOnDisable",
	ready: function()
	{
		return (window["ScrollableList"] != undefined);
	},
	apply: function()
	{
		ScrollableList.prototype.OnDisable = function()
		{
			if (this.wasPressed)
				this.OnPress(false);
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchIOSShadows",
	ready: function()
	{
		return (window["UILabel"] != undefined);
	},
	apply: function()
	{
		var needsPatch = (window["safari"] != undefined) || (document.documentElement.className.indexOf("iOS") >= 0);
		if (!needsPatch)
			return;

		var oUILI = UILabel.prototype.init;
		UILabel.prototype.init = function()
		{
			if (this.mOutline == true)
				this.mBlurShadow = false;
			oUILI.apply(this, arguments);
		}
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchTimedFreeRoundBonusManager",
	ready:function()
	{
		return (window["TimedFreeRoundBonusManager"] != undefined);
	},
	apply:function()
	{
		TimedFreeRoundBonusManager.prototype.UpdateTimer = function()
		{
			if (this.bonusRoundsData != null)
			{
				var clientServerDifference = this.currentTime - this.bonusRoundsData.RoundsLeft;
				if (clientServerDifference > 2)
					this.currentTime = this.bonusRoundsData.RoundsLeft;
			}

			var elapsedTime = Math.floor(this.currentTime);
			if (elapsedTime < 0)
				elapsedTime = 0;

			var seconds = Math.floor((elapsedTime % 60)).toString();
			var minutes = Math.floor(((elapsedTime / 60) % 60)).toString();
			
			if (seconds.length < 2)
				seconds = "0" + seconds;
			if (minutes.length < 2)
				minutes = "0" + minutes;

			if (this.currentTime < 0  && !XT.GetBool(Vars.Logic_IsFreeSpin) && !XT.GetBool(Vars.IsDifferentSpinType))
			{
				this.shouldUpdateTimer = false;
				if (this.cachedStartEvent.length > 0)
				{
					this.cachedStartEvent[0].Type = VsFreeRoundEvent.EventType.Finish;
					this.cachedStartEvent[0].Bet = this.cachedbetLevel;
				}
				XT.SetBool(Vars.SpinBlockingFeatureIsRunning, true);
				this.RequestToShow();
			}

			for (var i = 0; i < this.timeLabels.length; i++)
				this.timeLabels[i].text = minutes + ":" + seconds;

			this.currentTime -= Time.deltaTimeInRealTime;
		};
		
		TimedFreeRoundBonusManager.prototype.OnTimedBonusRoundsFinished = function()
		{
			this.isActive = false;
			XT.SetBool(Vars.TimedBonusRoundIsOngoing, false);
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchGBets",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && window["UHT_GAME_CONFIG_SRC"] != undefined);
	},
	apply:function()
	{
		if (IsRequired("GBETS"))
		{
			var oCCVACB = CoinManager.ComputeCoinValuesAndCurrentBet;
			CoinManager.ComputeCoinValuesAndCurrentBet = function(betsFromServer, lastBet, defaultBet)
			{
				var minBet = betsFromServer[0];
				var maxBet = betsFromServer[betsFromServer.length - 1];
				var curve = [ 0.05, 0.1, 0.2, 0.4 ];

				var levels = 10;

				while ((minBet*levels)<((maxBet/levels)*curve[0]))
					curve.unshift(curve[0]*0.2);

				if (maxBet/minBet < levels)
				{
					levels = ((maxBet * 1000) / (minBet * 1000)) | 0;
				}

				var maxCoinValue = ((maxBet * 1000) / levels) / 1000;
				var x = (maxCoinValue - minBet);

				var coinValues = [];
				coinValues.push(minBet);
				for (var j = 0; j < curve.length; j++)
				{
					var computedVal = CoinManager.GetNiceCoinValue(minBet + x * curve[j]);
					if ((computedVal > minBet) && (computedVal < maxCoinValue))
						coinValues.push(computedVal);
				}
				coinValues.push(maxCoinValue);

				for (var i = 1; i < coinValues.length; i++ )
				{
					if (Math.abs(coinValues[i] - coinValues[i - 1]) < 1e-3)
					{
						coinValues.splice(i, 1);
						i--;
					}
				}

				var generatedBets = [];
				for (var levelIndex = 1; levelIndex <= levels; levelIndex++)
				{
					for (var i = 0; i < coinValues.length; i++)
					{
						var value = levelIndex * (coinValues[i] * 100) / 100;
						if (generatedBets.indexOf(value) == -1)
							generatedBets.push(value);
					}
				}
				generatedBets = generatedBets.sort(function (a, b) { return a - b });
				arguments[0] = generatedBets;
				oCCVACB.apply(this, arguments);
			};
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchNOST_SB",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1 && window["StageSpin"] != undefined);
	},
	apply:function()
	{
		StageSpin.prototype.OnPressedStop = function()
		{
			if(XT.GetBool(Vars.AllowFastStop) && !XT.GetBool(Vars.DisableStopButton))
				XT.TriggerEvent(Vars.Evt_Internal_ReelManager_StopSpin);
		};

	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchHideBETMENUjakr",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply:function()
	{
		if (window["UHT_GAME_CONFIG_SRC"] != undefined && (UHT_GAME_CONFIG_SRC["lang"] == "ja" || UHT_GAME_CONFIG_SRC["lang"] == "ko"))
		{
			var t = globalRuntime.sceneRoots[1].transform.Find("UI Root/XTRoot/Root/Paytable/Pages/Common_Info2/BetMenu/Title/BetMenuLabel");
			if (t != null)
				t.gameObject.SetActive(false);
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});


UHTPatch({
	name: "PatchConvertLeaderboardToPlayerCurrency",
	ready:function()
	{
		return (window["TournamentConnection"] != undefined);
	},
	apply:function()
	{
		var oCLTPC = TournamentConnection.prototype.ConvertLeaderboardToPlayerCurrency;
		TournamentConnection.prototype.ConvertLeaderboardToPlayerCurrency = function()
		{
			if (!arguments[0]["leaderboard"])
				return;
			oCLTPC.apply(this, arguments);
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchHideFullScreenAfter5Seconds",
	ready:function()
	{
		return (window["IPhone8Helper"] != undefined);
	},
	apply:function()
	{
		if (FullScreenIPhoneHelper.USING_NEW_IMPLEMENTATION)
			return;
		IPhone8Helper.prototype.ResizeHandler = function(e)
		{
			var self = this;

			if (!this.GameStarted())
			{
				setTimeout(function(){ self.ResizeHandler() }, 100);
				return;
			}

			if (this.root == null)
				this.InitElements();

			var wasLandscape = this.isLandscape;
			this.isLandscape = window.innerWidth > window.innerHeight;

			if (!this.isTouch)
			{
				if(wasLandscape == this.isLandscape)
				{
					if(this.panelHiddenTime > 0)
					{
						if (Date.now() - this.panelHiddenTime < 69)
						{
							setTimeout(function(){ self.ResizeHandler(e); }, 500);
							return;
						}
					}
				}
				else
				{
					if (this.isLandscape && window.innerHeight != Math.min(screen.width, screen.height))
					{
						this.UpdateStyle(true);
						this.UpdateScrollable(true);
						UHTEventBroker.Trigger(UHTEventBroker.Type.Game, JSON.stringify({common: "EVT_FULLSCREEN_OVERLAY_SHOWN", args: null}));
						this.panelHiddenTime = -1;
						if (!this.isLandscape)
							this.QueueFullscreenHide();
						else if (timeoutOrientationChanged != null)
							clearTimeout(timeoutOrientationChanged);
					}
					this.ResetScroll();
				}
			}

			var screenHeight = this.isLandscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height) - 60;
			if(!this.isLandscape && screenHeight == 752)
				screenHeight -= 35;
			if(!this.isLandscape && screenHeight == 836)
				screenHeight -= 4;

			this.clientHeight = this.GetClientHeight();

			var wasTopPanel = this.isTopPanel;
			this.isTopPanel = this.clientHeight < screenHeight;

			if (this.isTopPanel)
			{
				if(!wasTopPanel)
				{
					this.UpdateStyle(true);
					this.ResetScroll();
					this.UpdateScrollable(true);
					UHTEventBroker.Trigger(UHTEventBroker.Type.Game, JSON.stringify({common: "EVT_FULLSCREEN_OVERLAY_SHOWN", args: null}));
					this.panelHiddenTime = -1;
					if (!this.isLandscape)
						this.QueueFullscreenHide();
					else if (timeoutOrientationChanged != null)
						clearTimeout(timeoutOrientationChanged);
				}
			}
			else
			{
				if(wasTopPanel)
				{
					this.UpdateStyle(false);
					UHTEventBroker.Trigger(UHTEventBroker.Type.Game, JSON.stringify({common: "EVT_FULLSCREEN_OVERLAY_HIDDEN", args: null}));
					this.panelHiddenTime = Date.now();
				}
				this.UpdateScrollable(false);
			}

			if (e !== undefined)
				setTimeout(function(){ self.ResizeHandler(); }, 500);
		};

		var timeoutOrientationChanged = null;
		IPhone8Helper.prototype.QueueFullscreenHide = function()
		{
			var self = this;
			if (timeoutOrientationChanged != null)
				clearTimeout(timeoutOrientationChanged);

			timeoutOrientationChanged = setTimeout(self.HideFullScreen, 3000, self);
		};

		IPhone8Helper.prototype.HideFullScreen = function(obj)
		{
			obj.UpdateStyle(false);
			UHTEventBroker.Trigger(UHTEventBroker.Type.Game, JSON.stringify({common: "EVT_FULLSCREEN_OVERLAY_HIDDEN", args: null}));
			obj.panelHiddenTime = Date.now();
			obj.UpdateScrollable(false);
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	},
});

UHTPatch({
	name: "PatchBonusRoundsStartWindowContinueLabel",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply:function()
	{
		this.OnBonusRoundCanBePlayedLater = function(value)
		{
			var paths = [
				"UI Root/XTRoot/Root/GUI/Interface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickContinueToStartPlaying!Label",
				"UI Root/XTRoot/Root/GUI_mobile/Interface_Landscape/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickContinueToStartPlaying!Label",
				"UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickContinueToStartPlaying!Label",
				"UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickContinue"
			];
			for (var i = 0; i < paths.length; i++)
			{
				var t = globalRuntime.sceneRoots[1].transform.Find(paths[i]);
				if (t != null)
					t.gameObject.SetActive(!value);
			}

			paths = [
				"UI Root/XTRoot/Root/GUI/Interface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickPlayNowToStartPlaying!Label",
				"UI Root/XTRoot/Root/GUI_mobile/Interface_Landscape/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickPlayNowToStartPlaying!Label",
				"UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickPlayNowToStartPlaying!Label",
				"UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Texts/ClickPlayNowToStartPlaying!Label"
			];
			for (var i = 0; i < paths.length; i++)
			{
				var t = globalRuntime.sceneRoots[1].transform.Find(paths[i]);
				if (t != null)
					t.gameObject.SetActive(false);
			}
		}
		XT.RegisterCallbackBool(Vars.BonusRoundCanBePlayedLater, this.OnBonusRoundCanBePlayedLater, this);
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchBonusRoundStartWindowLandscapeMobile",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply:function()
	{
		var paths = [
			"UI Root/XTRoot/Root/GUI_mobile/Interface_Landscape/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Buttons/PlayLater/ContinueButton",
			"UI Root/XTRoot/Root/GUI_mobile/Interface_Landscape/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsStartWindow/Buttons/PlayLater/ContinueLabel"
		];
		for (var i = 0; i < paths.length; i++)
		{
			var t = globalRuntime.sceneRoots[1].transform.Find(paths[i]);
			if (t != null)
				t.gameObject.transform.SetParent(t.transform.parent.parent.transform, true);
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchClock",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply:function()
	{
		if (UHT_GAME_CONFIG.GAME_SYMBOL.indexOf("vs") == 0)
		{
			if (!Globals.isMini)
			{
				if (UHT_GAME_CONFIG.STYLENAME.indexOf("genesis_") == 0 || UHT_GAME_CONFIG.STYLENAME.indexOf("em_") == 0 || IsRequired("ALTCLK"))
				{
					var clockDisplayers = globalRuntime.sceneRoots[1].GetComponentsInChildren(ClockDisplayer, true);
					for (var j = 0; j < clockDisplayers.length; j++)
					{
						clockDisplayers[j].hoursLabel.effectStyle = 2;
						clockDisplayers[j].hoursLabel.effectHeight = 2;
						clockDisplayers[j].hoursLabel.effectWidth = 2;
						clockDisplayers[j].hoursLabel.init(true);
						clockDisplayers[j].separatorLabel.effectStyle = 2;
						clockDisplayers[j].separatorLabel.effectHeight = 2;
						clockDisplayers[j].separatorLabel.effectWidth = 2;
						clockDisplayers[j].separatorLabel.init(true);
						clockDisplayers[j].minutesLabel.effectStyle = 2;
						clockDisplayers[j].minutesLabel.effectHeight = 2;
						clockDisplayers[j].minutesLabel.effectWidth = 2;
						clockDisplayers[j].minutesLabel.init(true);
					}
				}
			}
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchHidePressSpinLabelDesktop",
	ready:function()
	{
		return (window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply:function()
	{
		var t = globalRuntime.sceneRoots[1].transform.Find("UI Root/XTRoot/Root/Paytable/Pages/Common_Info1/HowToPlay/Rules/Bottom/Rule2Label");
		if (t != null)
			t.gameObject.SetActive(false);
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchDisableSpacebarSpin",
	ready:function()
	{
		return (window["Input"] != undefined);
	},
	apply:function()
	{
		if (UHT_GAME_CONFIG.STYLENAME.indexOf("gsys_gamesys") > -1)
		{
			Input.GetKeyDown = function(keyCode)
			{
				return false;
			};

			Input.GetKey = function(keyCode)
			{
				return false;
			};
		}
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchDisableFastPlayAndStopButton",
	ready:function()
	{
		return (window["VideoSlotsConnectionXTLayer"] != undefined);
	},
	apply:function()
	{
		if (UHT_GAME_CONFIG.STYLENAME.indexOf("gsys_gamesys") > -1)
		{
			var oVSCXTL_RS = VideoSlotsConnectionXTLayer.prototype.RequirementsSetup;
			VideoSlotsConnectionXTLayer.prototype.RequirementsSetup = function ()
			{
				ServerOptions.brandRequirements += ",NOST,NOFP";
				oVSCXTL_RS.apply(this, arguments);
			};
		}
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchHideVolatilityInfo",
	ready:function()
	{
		return (window["UHT_GAME_CONFIG"] != undefined && window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply:function()
	{
		if (window["UHT_GAME_CONFIG_SRC"] != undefined && UHT_GAME_CONFIG_SRC["region"] == "Asia")
		{
			var localizationRoot = globalRuntime.sceneRoots[1].GetComponentInChildren(LocalizationRoot);
			if (localizationRoot != null)
			{
				var transforms = localizationRoot.GetComponentsInChildren(Transform, true);
				for (var i = 0; i < transforms.length; i++)
				{
					if (transforms[i].gameObject.name.indexOf("VolatilityMeter") > -1)
						transforms[i].gameObject.SetActive(false);
				}
			}

			var paytable = globalRuntime.sceneRoots[1].GetComponentsInChildren(Paytable, true);
			if (paytable.length == 0)
				paytable = globalRuntime.sceneRoots[1].GetComponentsInChildren(Paytable_mobile, true);
			
			if (paytable.length > 0)
			{
				var transforms = paytable[0].GetComponentsInChildren(Transform, true);
				for (var i = 0; i < transforms.length; i++)
				{
					if (transforms[i].gameObject.name.indexOf("VolatilityMeter") > -1)
					{
						if (transforms[i].parent != null)
							if (transforms[i].parent.gameObject.name != "RealContent")
								transforms[i].parent.gameObject.SetActive(false);
							else
								transforms[i].gameObject.SetActive(false);
					}

					if (transforms[i].gameObject.name.indexOf("VolatilityRuleLabel") > -1)
					{
						transforms[i].gameObject.SetActive(false);
					}
				}
			}
		}
	},
	retry:function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchHideRTPInfo",
	ready: function()
	{
		return (window["UHT_GAME_CONFIG"] != undefined && window["globalRuntime"] != undefined && globalRuntime.sceneRoots.length > 1);
	},
	apply: function()
	{
		var mustApply = false;
		if (window["UHT_GAME_CONFIG_SRC"] != undefined && UHT_GAME_CONFIG_SRC["region"] == "Asia")
			mustApply = true;
		if (UHT_GAME_CONFIG.STYLENAME.indexOf("weinet_") > -1)
			mustApply = true;
		var extrastylenames=["ggn_ggpoker","ggn_ggpokerok"];
		if (extrastylenames.indexOf(UHT_GAME_CONFIG.STYLENAME)>-1)
			mustApply = true;

		
		var stylenames=["solidrdge_intercasino","solidrdge_verajohn","solid2_verajohn","nkt_10bet","nkt_baazi247","nkt_bangbangcasino","nkt_bollytech","nkt_rtsm","nkt_unikrn","bv10","bv8","bv9","bv2","bv6","bv15","bv7","hg_casitabi","hg_casinome","hg_purecasino","hg_simplecasinojp","hub88_hub88asia","hub88_hub88slotsb2basia","btcnst_vbetasia"];
		if (stylenames.indexOf(UHT_GAME_CONFIG.STYLENAME)>-1)
			mustApply = false;
		
		if (mustApply)
		{
			var gameHasRTPInfoSelector = window["RTPInfoSelector"] != undefined;
			if (gameHasRTPInfoSelector)
			{
				this.OnXTGameInit = function()
				{
					var rtpInfoTargets = globalRuntime.sceneRoots[1].GetComponentsInChildren(RTPInfoSelector, true);
					for (var i = 0; i < rtpInfoTargets.length; i++)
					{
						rtpInfoTargets[i].gameObject.SetActive(false);
					}
				}
				XT.RegisterCallbackEvent(Vars.Evt_Internal_GameInit, this.OnXTGameInit, this);
			}
			else
			{
				var paytable = globalRuntime.sceneRoots[1].GetComponentsInChildren(Paytable, true);
				if (paytable.length == 0)
					paytable = globalRuntime.sceneRoots[1].GetComponentsInChildren(Paytable_mobile, true);
				
				if (paytable.length == 0 && window["SCPaytable"])
					paytable = globalRuntime.sceneRoots[1].GetComponentsInChildren(SCPaytable, true);
				
				if (paytable.length > 0)
				{
					if (window["VarDisplayer"])
					{
						var rtpVarDisplayer = paytable[0].GetComponentsInChildren(VarDisplayer, true);
						for (var i = 0; i < rtpVarDisplayer.length; i++)
						{
							if (rtpVarDisplayer[i].variable.name == "ReturnToPlayer" || rtpVarDisplayer[i].variable.name == "ReturnToPlayerWithJackpot" || rtpVarDisplayer[i].variable.name == "ReturnToPlayerMinWithJackpot")
							{
								rtpVarDisplayer[i].label.transform.parent.gameObject.SetActive(false);
							}
						}
					}
					
					if (window["ValueDisplayer"])
					{
						var rtpValueDisplayer = paytable[0].GetComponentsInChildren(ValueDisplayer, true);
						for (var i = 0; i < rtpValueDisplayer.length; i++)
						{
							if (rtpValueDisplayer[i].actualVarName == "ReturnToPlayer" || rtpValueDisplayer[i].actualVarName == "ReturnToPlayerWithJackpot" || rtpValueDisplayer[i].actualVarName == "ReturnToPlayerMinWithJackpot")
							{
								rtpValueDisplayer[i].label.transform.parent.gameObject.SetActive(false);
							}
						}
					}
					
					if (window["AddVariablesToText"])
					{
						var rtpAddVariablesToText = paytable[0].GetComponentsInChildren(AddVariablesToText, true);
						for (var i = 0; i < rtpAddVariablesToText.length; i++)
						{
							for (var j = 0; j < rtpAddVariablesToText[i].someVariables.length; j++)
							{
								if (rtpAddVariablesToText[i].someVariables[j].variable.name == "ReturnToPlayer" || 
									rtpAddVariablesToText[i].someVariables[j].variable.name == "ReturnToPlayerWithJackpot" || 
									rtpAddVariablesToText[i].someVariables[j].variable.name == "ReturnToPlayerMinWithJackpot" ||
									rtpAddVariablesToText[i].someVariables[j].gameInfo_Name == "rtps"
									)
								{
									rtpAddVariablesToText[i].baseLabel.gameObject.SetActive(false);
								}
							}
						}
					}
				}
			}
		}
	},
	retry: function()
	{
		return window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"];
	}
});

UHTPatch({
	name: "PatchRemoveDemoLabel",
	ready:function()
	{
		return (window["DemoLabelPosition"] != undefined);
	},
	apply:function()
	{
		DemoLabelPosition.prototype.OnGameInit = function(){};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	}
});

UHTPatch({
	name: "PatchDontSendOpenCashierEvent",
	ready:function()
	{
		return (window["UHT_GAME_CONFIG"] != undefined);
	},
	apply:function()
	{
		var stylenames=["888_888casinouk","888_888casinoit","888_888casinoes","888_888casinodk","888_888casinose","888_888casinoro","888_888casinopt","888_888casinocom"];
		
		if (stylenames.indexOf(UHT_GAME_CONFIG.STYLENAME)>-1)
			window["UHT_DISABLEOPENCASHIEREVENT"]=true;
	},
	retry:function()
	{
		return true;
	}
});

UHTPatch({
	name: "PatchSMMCloseGameEvent",
	ready:function()
	{
		return (window["SystemMessageManager"] != undefined) && (window["SystemMessageManager"]["CloseGame"] != undefined);
	},
	apply:function()
	{
		var oSMMCG = SystemMessageManager.CloseGame;
		SystemMessageManager.CloseGame = function()
		{
			UHTInterfaceBOSS.PostMessage("gameQuit");
			oSMMCG.apply(this, arguments);
		}
	},
	retry:function()
	{
		return true;
	}
});

UHTPatch({
	name: "PatchSRMIframe",
	ready:function()
	{
		return (window["SwedishRegulationManager"] != undefined);
	},
	apply:function()
	{
		SwedishRegulationManager.prototype.OnUHTResize = function(/**Object*/ unused)
		{
			var canv = document.getElementsByTagName("canvas")[0];
			var rgsParent = document.getElementsByClassName("RGSContainerActive")[0].dataset;
			var pixelRatio = UHTScreen.height / window.innerHeight;
			var scale = 1 - (rgsParent.height * pixelRatio / UHTScreen.height);
			var sign = (document.documentElement.className.indexOf("iPhone") >= 0 && document.documentElement.id == "Mobile" && window.orientation == 90 && !window.frameElement) ? 1 : -1;
			var transY = sign * ((rgsParent.height * pixelRatio / (UHTScreen.height - rgsParent.height * pixelRatio)) / 2) * 100 ;
			canv.style.transform = "scale(" + scale + ") translateY(" + transY + "%)";
		};
	},
	retry:function()
	{
		return (window["Renderer"] == undefined);
	},
	interval: 100
});

function IsRequired(requirement)
{
	if (window["UHT_GAME_CONFIG_SRC"] == undefined)
		return false;
	
	var reqs = (window["UHT_GAME_CONFIG_SRC"].jurisdictionRequirements + "," + window["UHT_GAME_CONFIG_SRC"].brandRequirements).split(',');
	for (var i = 0; i < reqs.length; ++i)
	{
		var req = reqs[i];
		var splits = req.split("*");
		if (splits.length > 1)
		{
			var platform = (Globals.isMini?"MINI_":"")+(Globals.isMobile?"MOBILE":"DESKTOP");
			if (splits[1] == platform)
				req = splits[0];
		}
		if ((req == requirement)||(req == "["+window["UHT_GAME_CONFIG_SRC"].jurisdiction+"]"+requirement))
			return true;
	}
	return false;
}

var timeoutPatchCurrency = null;
function PatchCurrency()
{
	if (timeoutPatchCurrency != null)
		clearTimeout(timeoutPatchCurrency);
	if (window["CurrencyPatch"] == undefined)
	{
		timeoutPatchCurrency = setTimeout(PatchCurrency, 100);
		return;
	}
	var map=[{c:"BYN",s:"Br"},{c:"PEN",s:"S/."}];
	var oICI = CurrencyPatch.prototype.InitCurrencyInfo;
	CurrencyPatch.prototype.InitCurrencyInfo = function()
	{
		for (var i=0; i<map.length; i++)
			this.currencies[map[i].c+"sym"] = map[i].s;
		var ret = oICI.apply(this, arguments);
		if (["mnsn_m88"].indexOf(UHT_GAME_CONFIG.STYLENAME) > -1)
		{
			ret.CurrencySymbol="";
			ret.CurrencyPositivePattern = 0;
			ret.CurrencyNegativePattern = 0;
		}
		return ret;
	}
}
PatchCurrency();


var timeoutPatchGA = null;
function PatchGA()
{
	if (timeoutPatchGA != null)
		clearTimeout(timeoutPatchGA);
	if (window["Tracking"] == undefined)
	{
		timeoutPatchGA = setTimeout(PatchGA, 1000);
		return;
	}
	var oT_SE = Tracking.prototype.SendEvent;
	Tracking.prototype.SendEvent = function()
	{
		if (arguments[3] == "SpinTracker")
			arguments[3] = "ST" + SPIN_TRACKER_ID;
		oT_SE.apply(this, arguments);
	}
	var oT_STAS = Tracking.prototype.StopTimerAndSend;
	Tracking.prototype.StopTimerAndSend = function()
	{
		var oLength = globalTracking.QueuedTimers.length;
		oT_STAS.apply(this, arguments);
		if ((arguments[2] == "SpinTracker") && globalTracking.QueuedTimers.length > oLength)
		{
			globalTracking.QueuedTimers[globalTracking.QueuedTimers.length - 1].type = "ST" + SPIN_TRACKER_ID;
		}
		
	}
}
PatchGA();



var timeoutPatchTCU = null;
function PatchTCU()
{
	if (timeoutPatchTCU != null)
		clearTimeout(timeoutPatchTCU);
	if (window["TournamentConnection"] == undefined)
	{
		timeoutPatchTCU = setTimeout(PatchTCU, 10);
		return;
	}
	var oTCU = TournamentConnection.prototype.Update;
	TournamentConnection.prototype.Update = function()
	{
		this.isRacePrizesReloaded = true;
		oTCU.apply(this, arguments)
	}
	if (window["LobbyConnection"] != undefined)
	{
		var oFP = LobbyConnection.prototype.FindPromotion;
		LobbyConnection.prototype.FindPromotion = function()
		{
			if (this.promoResponse==null)
				return null;
			return oFP.apply(this, arguments)
		}
	}
	
	if (window["LobbyCategoriesManager"] != undefined)
		LobbyCategoriesManager.prototype.FindLocalizedLabel = function(/**string*/ name)
		{
			for (var i = 0; i < this.localizedLabels.length; ++i)
				if (this.localizedLabels[i].gameObject.name == name)
					return this.localizedLabels[i];

			return null;
		};
}
PatchTCU();

var timeoutPatchMCS_SQ = null;
function PatchMCS_SQ()
{
	if (timeoutPatchMCS_SQ != null)
		clearTimeout(timeoutPatchMCS_SQ);
	if (window["MoneyCollectSequence_ScarabQueen"] == undefined)
	{
		timeoutPatchMCS_SQ = setTimeout(PatchMCS_SQ, 1000);
		return;
	}
	var oMCS_SQ = MoneyCollectSequence_ScarabQueen.prototype.PatchAndProcessData;
	MoneyCollectSequence_ScarabQueen.prototype.PatchAndProcessData = function()
	{
		if (XT.GetObject(Vars.RandomMysterySymbolId) == null)
        	return;

		return oMCS_SQ.apply(this, arguments);
	}
}
PatchMCS_SQ();

var timeoutPatchSpinExciter = null;
function PatchSpinExciter()
{
	if (timeoutPatchSpinExciter != null)
		clearTimeout(timeoutPatchSpinExciter);
	if (window["VS_SpinExciter"] == undefined)
	{
		timeoutPatchSpinExciter = setTimeout(PatchSpinExciter, 10);
		return;
	}
	var oSAOR = VS_SpinExciter.prototype.SymbolAppearencesOnReel;
	VS_SpinExciter.prototype.SymbolAppearencesOnReel = function(symbolId, reelidx)
	{
		this.symbolId = symbolId;
		return oSAOR.call(this,symbolId, reelidx);
	}
}
PatchSpinExciter();

var timeoutPatchCustomMessagesLabels = null;
function PatchCustomMessagesLabels()
{
	if (timeoutPatchCustomMessagesLabels != null)
		clearTimeout(timeoutPatchCustomMessagesLabels);
	if (window["SystemMessageManager"] == undefined)
	{
		timeoutPatchCustomMessagesLabels = setTimeout(PatchCustomMessagesLabels, 10);
		return;
	}
	var oPT = SystemMessageManager.ProcessText;
	SystemMessageManager.ProcessText = function(text)
	{
		if (text != undefined)
			return oPT.call(this, text);
		else
			return text;
	}
}
PatchCustomMessagesLabels();

var timeoutPatchAGCC = null;
function PatchAGCC()  // AND CHINESE SOUND FOR PROMOTIONS
{
	if (timeoutPatchAGCC != null)
		clearTimeout(timeoutPatchAGCC);

	var fixed = false;
	
	if (window["globalRuntime"] != undefined)
		if (window["globalRuntime"].sceneRoots.length > 0)
		{
			var paths = [
				"UI Root/LoaderParent/Loader/AGCC", //agcc
				]
			
			var roots = globalRuntime.sceneRoots;

			for (var r = 0; r < roots.length; ++r)
			{
				for (var i = 0; i < paths.length; ++i)
				{
					var t = roots[r].transform.Find(paths[i]);
					if (t != null)
					{
						t.gameObject.transform.localScale(0.85, 0.85, 0.85);
					}
				}
			}
			
			// CHINESE SOUND
			
			if (globalRuntime.sceneRoots.length > 1)
			{
				if (window["PromotionContentSwitcher"] != undefined)
				{
					var pcs = globalRuntime.sceneRoots[1].GetComponentsInChildren(PromotionContentSwitcher, true);
					for (var s=0; s<pcs.length; s++)
					{
						var pc = pcs[s];
						for (var a=0; a<pc.asiaContents.length; a++)
						{
							var asp = pc.asiaContents[a].GetComponent(SoundPlayer);
							if (asp != null && a<pc.europeContents.length)
							{
								var esp = pc.europeContents[a].GetComponent(SoundPlayer);
								if (esp != null)
									asp.audioClip = esp.audioClip;
							}
						}
					}
				}
				fixed = true; //move this outside when reverting - this must remain
			}
		}
		
	if (!fixed)
	{
		timeoutPatchAGCC = setTimeout(PatchAGCC, 10);
		return;
	}
}
PatchAGCC();

var timeoutPatchCFullscreen = null;
function PatchCFullscreen()
{
	if (timeoutPatchCFullscreen != null)
		clearTimeout(timeoutPatchCFullscreen);
	
	if (window["screenfull"] != undefined)
	{
		var mustDisable = false;
		if (["pxlbt_pixelbetse", "pxlbt_pixelbet","yb_yabo","pxlbt_pixelbetde"].indexOf(UHT_GAME_CONFIG.STYLENAME) > -1)
			mustDisable = true;
		if ((window["UHT_GAME_CONFIG_SRC"] != undefined) && (UHT_GAME_CONFIG_SRC["integrationType"] == "BETWAY"))
			mustDisable = true;
		
		if (mustDisable)
		{
			//Disable for some
			window["screenfull"]["request"] = function(elem) {};
		}
		else
		{
			//Handle it simpler for all the rest - Not that simple, but works in Chrome < 71 also now
			window["screenfull"]["request"] = function(elem)
			{
				var info = UAParser2();
				if ((info.os.name == "iOS") || (info.os.name == "Mac OS"))
					return;
				var request = this.raw.requestFullscreen;
				elem = elem || document.documentElement;
				elem[request]({navigationUI: "hide"});
			}
		}			
		return;
	}
	timeoutPatchCFullscreen = setTimeout(PatchCFullscreen, 10);
}
PatchCFullscreen();


var timeoutPatchFFSound = null;
var oCSR = null;
function PatchFFSound()
{
	if (timeoutPatchFFSound != null)
		clearTimeout(timeoutPatchFFSound);
	if (window["createjs"] != undefined)
		if (window["createjs"]["Sound"] != undefined)
			if (window["createjs"]["Sound"]["registerPlugins"] != undefined)
			{
				oCSR = createjs.Sound.registerPlugins;
				createjs.Sound.registerPlugins = function(arg)
				{
					if (arg.length > 1)
						return oCSR(arg);
					return false;
				};
				return;
			}
	timeoutPatchFFSound = setTimeout(PatchFFSound, 10);
}
PatchFFSound();


var timeoutPatchXTVars = null;
function PatchXTVars()
{
	if (timeoutPatchXTVars != null)
		clearTimeout(timeoutPatchXTVars);
	if (window["XT"] == undefined || window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchXTVars = setTimeout(PatchXTVars, 10);
		return;
	}
	var oXTRAI = XT.RegisterAndInit;
	XT.RegisterAndInit = function(go)
	{
		oXTRAI.call(this,go);
		
		// Disable autoplay
		var DisableAutoplay = false;
		var stylenames = ["NYX939", "atg_atg"];
		if (stylenames.indexOf(UHT_GAME_CONFIG.STYLENAME) > -1)
			DisableAutoplay = true;

		if (DisableAutoplay)
			if (Vars.Jurisdiction_DisableAutoplay != undefined)
				XT.SetBool(Vars.Jurisdiction_DisableAutoplay, true);

		// Instant autoplay
		var InstantAutoplay = false;
		if (UHT_GAME_CONFIG.STYLENAME == "_??????????????????????????????_")
			InstantAutoplay = true;

		if (InstantAutoplay)
			if (Vars.InstantAutoplay != undefined)
				XT.SetBool(Vars.InstantAutoplay, true);

			
	}
}
PatchXTVars();

var timeoutPatchCloseEvent = null;
function PatchCloseEvent()
{
	if (timeoutPatchCloseEvent != null)
		clearTimeout(timeoutPatchCloseEvent);
	if (window["UHTInterfaceBOSS"] == undefined)
	{
		timeoutPatchCloseEvent = setTimeout(PatchCloseEvent, 100);
		return;
	}
	var oOBU = window.onbeforeunload;
	window.onbeforeunload = function()
	{
		var lastEventIndex = globalTracking.QueuedEvents.length - 1;
		var willSent = (lastEventIndex == -1) || (lastEventIndex > -1 && globalTracking.QueuedEvents[lastEventIndex].action.indexOf("OpenedFromLobby_") == -1);
		if (willSent)
			UHTInterfaceBOSS.PostMessage("notifyCloseContainer");
		oOBU.call(this);
	}
}
PatchCloseEvent();


var timeoutPatchZeroSizeScreen = null;
function PatchZeroSizeScreen()
{
	if (timeoutPatchZeroSizeScreen != null)
		clearTimeout(timeoutPatchZeroSizeScreen);
	if (window["Camera"] == undefined)
	{
		timeoutPatchZeroSizeScreen = setTimeout(PatchZeroSizeScreen, 100);
		return;
	}
	var oCU = Camera.prototype.Update;
	Camera.prototype.Update = function()
	{
		if (UHTScreen.height == 0) UHTScreen.height = 1;
		if (UHTScreen.width == 0) UHTScreen.width = 1;
		oCU.call(this);
	}
}
PatchZeroSizeScreen();

var timeoutPatchEnableDesktopHomeButton = null;
function PatchEnableDesktopHomeButton()
{
	if (timeoutPatchEnableDesktopHomeButton != null)
		clearTimeout(timeoutPatchEnableDesktopHomeButton);
	
	if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchEnableDesktopHomeButton = setTimeout(PatchEnableDesktopHomeButton, 100);
		return;
	}
	var ShowHomeOnDesktop = false;
	var styleNameList = "sbod_sbotest,sbod_sbotry,sbod_sbobetvip,cer_casino999dk,cer_vikings".split(",");
	for (var i = 0; i < styleNameList.length; i++)
	{
		if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
		{
			ShowHomeOnDesktop = true;
			break;
		}
	}
	
	if (UHT_GAME_CONFIG.STYLENAME.indexOf("gsys_gamesys") > -1)
		ShowHomeOnDesktop = true;
	
	if (!ShowHomeOnDesktop)
		return;
	
	if (window["globalRuntime"] != undefined && (window["globalRuntime"].sceneRoots.length > 1))
	{
		//SHOW HOME BUTTON
		var homePaths = [
			"UI Root/XTRoot/Root/GUI/Interface/Windows/MenuWindow/Content/Links/WithoutPromoUrl/Home", //show home button desktop WithoutPromoUrl
			"UI Root/XTRoot/Root/GUI/Interface/Windows/MenuWindow/Content/Links/WithPromoUrl/Home", //show home button desktop WithPromoUrl
			]
		
			for (var i = 0; i < homePaths.length; ++i)
			{
				var t = window["globalRuntime"].sceneRoots[1].transform.Find(homePaths[i]);
				if (t != null)
					t.gameObject.SetActive(true);
			}
		
	}
	else
	{
		timeoutPatchEnableDesktopHomeButton = setTimeout(PatchEnableDesktopHomeButton, 100);
	}
}
PatchEnableDesktopHomeButton();

var timeoutPatchHomeButtonDemoMode = null;
function PatchHomeButtonDemoMode()
{
	if (timeoutPatchHomeButtonDemoMode != null)
		clearTimeout(timeoutPatchHomeButtonDemoMode);
	
	if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchHomeButtonDemoMode = setTimeout(PatchHomeButtonDemoMode, 100);
		return;
	}
    
    var shouldPatch = false;
    if (window["UHT_GAME_CONFIG"]["demoMode"])
        shouldPatch = true;
		
	if (!shouldPatch)
		return;
	
	if (window["globalRuntime"] != undefined && (window["globalRuntime"].sceneRoots.length > 1))
	{
        var OnRequestToCloseGame = function()
        {
            window.parent.postMessage(JSON.stringify({action: 'omni-api.goTo', actionData: 'lobby' }), '*');
        }
        XT.RegisterCallbackEvent(Vars.Evt_ToServer_CloseGame, OnRequestToCloseGame, this);	
	}
	else
	{
		timeoutPatchHomeButtonDemoMode = setTimeout(PatchHomeButtonDemoMode, 100);
	}
}
PatchHomeButtonDemoMode();

var timeoutPatchHidePPlogo = null;
function PatchHidePPlogo()
{
	if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchHidePPlogo = setTimeout(PatchHidePPlogo, 10);
		return;
	}
	var HideLogo = false;
	if (UHT_GAME_CONFIG.STYLENAME == "ebetgrp_ebet")
		HideLogo = true;

	if (UHT_GAME_CONFIG.STYLENAME == "vb-dafa")
		HideLogo = true;

	if (UHT_GAME_CONFIG.STYLENAME == "SBO")
		HideLogo = true;
	
	if (UHT_GAME_CONFIG.STYLENAME == "SB2")
		HideLogo = true;
	
	if (!HideLogo)
		return;
		
	if (timeoutPatchHidePPlogo != null)
		clearTimeout(timeoutPatchHidePPlogo);

	if (window["globalRuntime"] == undefined)
	{
		timeoutPatchHidePPlogo = setTimeout(PatchHidePPlogo, 10);
		return;
	}
	
	var paths = [
		"UI Root/XTRoot/Root/GUI/PragmaticPlayAnchor", //hide desktop tm
		"UI Root/XTRoot/Root/GUI_mobile/PragmaticPlayAnchor", //hide mobile tm
		"UI Root/LoaderParent/Loader/Logo", //hide client logo
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_portrait/Page2/Content/RealContent/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_portrait/Page4/Content/RealContent/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_portrait/Page6/Content/RealContent/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_portrait/Page8/Content/RealContent/CopyrightHolder", // hide QoG copyright

		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_landscape/Page2/Content/RealContent/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_landscape/Page4/Content/RealContent/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_landscape/Page6/Content/RealContent/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable_mobile/Paytable_landscape/Page8/Content/RealContent/CopyrightHolder", // hide QoG copyright
		
		"UI Root/XTRoot/Root/Paytable/Pages/Page1/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable/Pages/Page2/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable/Pages/Page3/CopyrightHolder", // hide QoG copyright
		"UI Root/XTRoot/Root/Paytable/Pages/Page4/CopyrightHolder" // hide QoG copyright

		]
	
	var roots = globalRuntime.sceneRoots;

    for (var r = 0; r < roots.length; ++r)
    {
        for (var i = 0; i < paths.length; ++i)
        {
            var t = roots[r].transform.Find(paths[i]);
            if (t != null)
                t.gameObject.SetActive(false);
        }
    }
	
	if (globalRuntime.sceneRoots.length < 2)
	{
		timeoutPatchHidePPlogo = setTimeout(PatchHidePPlogo, 10);
	}
}
PatchHidePPlogo();

var timeoutPatchRCCloseParentWindowRedirect = null;
function PatchRCCloseParentWindowRedirect()
{
    if (timeoutPatchRCCloseParentWindowRedirect != null)
		clearTimeout(timeoutPatchRCCloseParentWindowRedirect);
	
    if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchRCCloseParentWindowRedirect = setTimeout(PatchRCCloseParentWindowRedirect, 100);
		return;
	}
    
    var shouldPatch = false;
	var styleNameList = "isb_stoiximanro-prod,isb_stoiximanpt-prod,isb_stoiximangr-lux-prod,isb_stoiximande-lux-prod,isb_stoiximanbr-lux-prod,isb_sbtech_prod,isb_sbtech_prod-uk".split(",");
	for (var i = 0; i < styleNameList.length; i++)
	{
		if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
		{
			shouldPatch = true;
			break;
		}
	}

	if (!shouldPatch)
		return;
    
	if (window["SystemMessageManager"] == undefined)
	{
		timeoutPatchRCCloseParentWindowRedirect = setTimeout(PatchRCCloseParentWindowRedirect, 100);
		return;
	}
	
    SystemMessageManager.RCClose = function()
    {
        if (RCCloseURL != undefined)
        {
            if (RCCloseURL_Type == "notify")
            {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", RCCloseURL, true);
                xhr.send(null);
    
                UHTEventBroker.Trigger(UHTEventBroker.Type.Adapter, JSON.stringify({common: "EVT_CLOSE_GAME", args: null}));
            }
            else
                window.top.location.href = RCCloseURL;
        }
        else
            UHTEventBroker.Trigger(UHTEventBroker.Type.Adapter, JSON.stringify({common: "EVT_CLOSE_GAME", args: null}));
    };
}
PatchRCCloseParentWindowRedirect();

var timeoutPatchPlayNowButton = null;
function PatchPlayNowButton()
{
	if (timeoutPatchPlayNowButton != null)
		clearTimeout(timeoutPatchPlayNowButton);
	
	if (window["globalRuntime"] != undefined && (window["globalRuntime"].sceneRoots.length > 1))
	{
        if (window["TournamentSimpleOptIn"] == undefined)
            return;

        var tSOI = globalRuntime.sceneRoots[1].GetComponentsInChildren(TournamentSimpleOptIn, true)[0];
        tSOI.RemoveButtonAndPatchText = function() {
            this.disableOptOut.Start();
            var roots = globalRuntime.sceneRoots;
            for (var i = 0; i < roots.length; i++)
                if (Globals.isMini) {
                    var joinNowLabel = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/Content/Window/Bottom/Buttons/OptInLabel");
                    if (joinNowLabel != null) {
                        var label = joinNowLabel.transform.GetComponentsInChildren(UILabel, true)[0];
                        var okLabelTransform = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/NoMoneyWindow/Button/NoMoneyButtonLabel");
                        if (okLabelTransform != null)
                        {
                            var okLabel = okLabelTransform.transform.GetComponentsInChildren(UILabel, true)[0];
                            label.text = okLabel.text;
                        }
                    }
                    var buttonsParent = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/Content/Window/Bottom/Buttons");
                    if (buttonsParent != null) {
                        var multipleLabelAnchor = buttonsParent.transform.GetComponentsInChildren(MultipleLabelAnchor, true)[0];
                        multipleLabelAnchor.ignoreInactiveLabels = true
                    }
                } else if (Globals.isMobile) {
                    var joinNowLabelLand = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/Content/ContentAnimator/Content/Land/Buttons/JoinNowLabel");
                    if (joinNowLabelLand != null) {
                        var label = joinNowLabelLand.transform.GetComponentsInChildren(UILabel, true)[0];
                        var okLabelTransform = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/QuickSpinArrangeable/QuickSpinAnimator/QuickSpin/Window/Content/Land/CloseButton/OkLabel");
                        if (okLabelTransform != null)
                        {
                            var okLabel = okLabelTransform.transform.GetComponentsInChildren(UILabel, true)[0];
                            label.text = okLabel.text;
                        }
                    }

                    var joinNowLabelPort = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/Content/ContentAnimator/Content/Port/Buttons/OptIn/JoinNowLabel");
                    if (joinNowLabelPort != null) {
                        var label = joinNowLabelPort.transform.GetComponentsInChildren(UILabel, true)[0];
                        var okLabelTransform = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/QuickSpinArrangeable/QuickSpinAnimator/QuickSpin/Window/Content/Port/CloseButton/OkLabel");
                        if (okLabelTransform != null)
                        {
                            var okLabel = okLabelTransform.transform.GetComponentsInChildren(UILabel, true)[0];
                            label.text = okLabel.text;
                        }
                    }

                    var optInParent = roots[i].transform.Find("UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/Content/ContentAnimator/Content/Port/Buttons/OptIn");
                    if (optInParent != null) {
                        var pos = optInParent.transform.localPosition();
                        optInParent.transform.localPosition(pos.x, pos.y - 120, pos.z);
                        var label = optInParent.transform.GetComponentsInChildren(UILabel, true)[0];
                    }
                } else {
                    var joinNowLabel = roots[i].transform.Find("UI Root/XTRoot/Root/GUI/Tournament/Tournament/PromotionsAnnouncer/ContentAnimator/Content/Window/Buttons/JoinNowLabel");
                    if (joinNowLabel != null) {
                        var label = joinNowLabel.transform.GetComponentsInChildren(UILabel, true)[0];
                        var okLabelTransform = roots[i].transform.Find("UI Root/XTRoot/Root/GUI/QuickSpinAnimator/QuickSpin/Window/Content/CloseButton/OkLabel");
                        if (okLabelTransform != null)
                        {
                            var okLabel = okLabelTransform.transform.GetComponentsInChildren(UILabel, true)[0];
                            label.text = okLabel.text;
                        }
                    }
                }
        }
	}
	else
	{
		timeoutPatchPlayNowButton = setTimeout(PatchPlayNowButton, 100);
	}
}
PatchPlayNowButton();

var timeoutPatchSpinButtonColliderDesktop = null;
function PatchSpinButtonColliderDesktop()
{
	if (timeoutPatchSpinButtonColliderDesktop != null)
		clearTimeout(timeoutPatchSpinButtonColliderDesktop);
	
	var fixed = false;

	if (window["globalRuntime"] != undefined)
	{
		if (window["globalRuntime"].sceneRoots.length > 0)
		{
			if (Globals.isMobile)
				return;

			var paths = [
				"UI Root/XTRoot/Root/GUI/Interface/TopBar/RightGroup/SpinButtons/StartSpin_Button",
				"UI Root/XTRoot/Root/GUI/Interface/TopBar/RightGroup/SpinButtons/StopSpin_Button"
			]
			
			var roots = globalRuntime.sceneRoots;

			for (var r = 0; r < roots.length; ++r)
			{
				for (var i = 0; i < paths.length; ++i)
				{
					var t = roots[r].transform.Find(paths[i]);
					if (t != null)
					{
						var collider = t.GetComponentsInChildren(Collider, true)[0];
						if (collider != null)
						{
							collider.size.x = 80;
							collider.size.y = 80;
							collider.transform.SetAllDirtyUserFlags();
							fixed = true;
						}
					}
				}
			}
		}
	}
	
	if (!fixed)
	{
		timeoutPatchSpinButtonColliderDesktop = setTimeout(PatchSpinButtonColliderDesktop, 100);
		return;
	}
}
PatchSpinButtonColliderDesktop();

var timeoutLobbyCategoriesDesktopNullCategoryFix = null;
function LobbyCategoriesDesktopNullCategoryFix()
{
	if (timeoutLobbyCategoriesDesktopNullCategoryFix != null)
		clearTimeout(timeoutLobbyCategoriesDesktopNullCategoryFix);
	
	var fixed = false;

	if (window["globalRuntime"] != undefined)
	{
		if (window["globalRuntime"].sceneRoots.length > 0)
		{
			if (window["LobbyConnection"] != undefined)
			{
				LobbyConnection.prototype.FindCategory = function(/**string*/ symbol)
				{
					for (var i = 0; i < this.categories.length; ++i)
						if (this.categories[i] != null && this.categories[i].symbol.toLowerCase() == symbol.toLowerCase())
							return this.categories[i];

					return null;
				};
				fixed = true;
			}
		}
	}
	
	if (!fixed)
	{
		timeoutLobbyCategoriesDesktopNullCategoryFix = setTimeout(LobbyCategoriesDesktopNullCategoryFix, 100);
		return;
	}
}
LobbyCategoriesDesktopNullCategoryFix();

var timeoutFRBWrongTotalBetWhenMultipleBetLevelsMultipliers = null;
function FRBWrongTotalBetWhenMultipleBetLevelsMultipliers()
{
	if (timeoutFRBWrongTotalBetWhenMultipleBetLevelsMultipliers != null)
		clearTimeout(timeoutFRBWrongTotalBetWhenMultipleBetLevelsMultipliers);
	
	var fixed = false;

    if (window["BonusRoundsController"] != undefined)
    {
        if(UHT_GAME_CONFIG.GAME_SYMBOL.indexOf("vs20fruitsw") == -1 && UHT_GAME_CONFIG.GAME_SYMBOL.indexOf("vs20sbxmas") == -1 && UHT_GAME_CONFIG.GAME_SYMBOL.indexOf("vswaysrhino") == -1)
        {
            BonusRoundsController.SetLines = function (lines)
            {
                XT.SetInt(Vars.BetToTotalBetMultiplier, lines);
                XT.SetInt(Vars.Lines, XT.GetBool(Vars.GameHasWaysInsteadOfLines) ? XT.GetInt(Vars.TotalNumberOfLines) : lines);
            }
        }
        fixed = true;
    }
	
	if (!fixed)
	{
		timeoutFRBWrongTotalBetWhenMultipleBetLevelsMultipliers = setTimeout(FRBWrongTotalBetWhenMultipleBetLevelsMultipliers, 100);
		return;
	}
}
FRBWrongTotalBetWhenMultipleBetLevelsMultipliers();

var timeoutEnablePrizeDropManuallyCredited = null;
function EnablePrizeDropManuallyCredited()
{
	if (timeoutEnablePrizeDropManuallyCredited != null)
		clearTimeout(timeoutEnablePrizeDropManuallyCredited);
	
	if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutEnablePrizeDropManuallyCredited = setTimeout(EnablePrizeDropManuallyCredited, 100);
		return;
	}

	var shouldEnable = false;
	var styleNameList = "oia_pinterbet,rctv_betn1,efbet_efbetitaly,isb_winmasterscommga-lux-prod,isb_winmastersgrmga-lux-prod,spr7_superseven,rtz_caxinoat,rtz_wheelzat,rtz_wildzat,casinobuck,sfws_casinobucksw,scmt_ioscommetto,scmt_loginbet,scmt_overbet,rctv_liberogioco,ext_bettilt,gt_aspercasino,jetcasino,scmt_gfbwin,scmt_gs24,scmt_il10bet,scmt_italiagioco,scmt_scommettendo,scmt_skiller,sfsw_baocasino,sfsw_betamo,sfsw_betchan,sfsw_bethub,sfsw_bitcoin_cash2,sfsw_bobcasino,sfsw_casinochan,sfsw_cobracasinosw,sfsw_cookiecasinosw,sfsw_dasistsw,sfsw_duelbitssw,sfsw_duxcasinosw,sfsw_easygosw,sfsw_getslotssw,sfsw_getwinsw,sfsw_greesnpinsw,sfsw_iluckisw,sfsw_innovisionsw,sfsw_jetwinsw,sfsw_ladyhammer,sfsw_manekisw,sfsw_masonslotssw,sfsw_mbit,sfsw_n1casino,sfsw_pegas21sw,sfsw_playamo,sfsw_princess,sfsw_slothunter,sfsw_slotwolfsw,sfsw_spini,sfsw_winningdays,sfsw_winzsw,sfsw_woocasinosw,sfws_albert2,sfws_avalon78sw,sfws_freshcasino,sfws_jetcasinosw,sfws_roxcasino,sfws_solcasino,tnls_betsson,sfws_nightrushsw,sfws_turbicosw,sfws_manekisw,ur_betandplaymga,ur_elcaradomga,ur_lapalingomga,ur_lapalingode,ur_lordluckyde,sfws_spinsamuraisw,spinsamurai,sfws_redstar,gt_paribahis,gt_casino360,fpsw_platinumcasinoro,rctv_boruntou1x2,rctv_cashtv,rctv_sports4africa,rctv_sports4africa2,sfws_spinuraisw,spinurai,sfws_betsedge,betsedge,sfws_oshisw,oshi,sfws_kimvegassw,NYX626,LHN,st_betzestmga,s2b_bokacasinocom,s2b_winotacom,s2b_betiniacom,slbt_solbetcom,goldenstar,sfws_goldenstar,gunsbet,sfws_gunsbet,euslot,sfws_euslot,crazyfox,sfws_crazyfox,megaslot,sfws_megaslot,loki,sfws_loki_softswisssw,vsnm_betmotioncom,rfranco_wanabetes,PLAYTECHbgo,sfws_winnysw,genesis_casinocruise,genesis_casinocruisede,genesis_casinocruiseuk,genesis_casinogods,genesis_casinogodsde,genesis_casinogodsuk,genesis_casinojoy,genesis_casinojoyde,genesis_casinojoyuk,genesis_casinolab,genesis_casinolabde,genesis_casinolabuk,genesis_casinoplanet,genesis_casinoplanetde,genesis_casinoplanetuk,genesis_casoola,genesis_casoolade,genesis_casoolauk,genesis_genesiscasino,genesis_genesiscasinode,genesis_genesiscasinouk,genesis_kassu,genesis_kassude,genesis_kassuuk,genesis_pelaa,genesis_pelaade,genesis_pelaauk,genesis_sloty,genesis_slotyde,genesis_slotyuk,genesis_spela,genesis_spelade,genesis_spelauk,genesis_spinit,genesis_spinitde,genesis_vegashero,genesis_vegasherode,genesis_vegasherouk,mgops_mrgreende,csnp_bplaycomar,slts_bplaycompy,winningdays,isb_luckiaco-lux-prod,xc_prod_sc_it,xc_prod_sb_it,xc_prod_ps_it,isb_starcasino-prod,cng_betika,tat_tetatete,dench_blitzspins,NYX1436,rtz_wildz_de,rtz_caxino_de,duelzde,nyspinsde,voodoodreamsde,pb_paddypower,pb_betfair,twincasinode,casinocalzonede,dreamzde,dunderde,shadowbetde,bs_rizkde,csm_kazoomde,csm_dunderde,csm_dunder,ext_plaingaming-de,jrscvnt_casinojefede,jrscvnt_luckydinode,cobracasino,ilucki,csm_kazoom,s2b_irokobetcom,BWINES,PARTYES,highroller,easygo,bitcoin_cash2,iforium_willhilles,jrscvnt_casinojefe,jrscvnt_kalevala,jrscvnt_luckydino,jrscvnt_olaspill,topsp_topsport,innovision,slothunter,megalotto,OKTAGONBET,rtz_caxino,NYX671,iforium_williamhill,isb_stoiximanbr-lux-prod,pegas21,bethub,LOB,CASINOCLUB,A1,A2,A3,A4,A5,A6,A7,A8,A9,A10,A11,A12,A13,A14,A15,A16,A17,A18,A19,A20,A21,A22,A23,A24,A25,A26,A27,A28,A29,A30,A31,A32,A33,A34,A35,A36,A37,A38,A39,A40,A41,A42,A43,A44,A45,A46,A47,A48,A49,A50,A51,A52,A53,A54,A55,A56,A57,A58,A59,A60,A61,A62,A63,A64,A65,A66,A67,A68,A69,A70,A71,A72,A73,A74,A75,A76,A77,A78,A79,A80,A81,A82,A83,ASP,greenspin,EWN,Avalon 78,bs_rizkuk,bs_rizk,bs_gutsuk,bs_guts,bs_kaboo,bs_kaboouk,isb_10betcom-lux-prod,isb_10betcom_prod-uk,isb_10betcompurse-lux-prod,isb_10betcompurse-ald-prod,isb_sbtech_prod-uk,slotbar,skycity,vippark,isb_stoiximande-lux-prod,ext_plaingaming,luckystreak-PlayLogia,luckystreak-PlayLogia_Machance,luckystreak-PlayLogia_VegasPlus,ctd_superbet,landbrokesvegas,isb_stoiximangr-lux-prod,voodoodreams,voodoodreamsuk,nyspins,nyspinsuk,freshcasino,Sol.casino,betamo,masonslots,baocasino,PLAYTECHtitanpoker,metalcasino,metalcasinouk,ladyhammer,redstar,slotman,agentspinner,karjalakasino,tnls_paston,em_betwarrior,cashmio,cashmiouk,isb_casinox-prod,isb_joycasino-prod,NYX405,dasist,NYX998,NYX681,btcnst_betvakti,btcnst_vegabet,btcnst_tigersbet,btcnst_harikabet,btcnst_nakitbahis,btcnst_ohmbet,btcnst_betticket,btcnst_kolaybet,btcnst_betmoon,btcnst_levelle,btcnst_1kickbet,btcnst_veerbet,btcnst_timescores,btcnst_betclub,btcnst_vipbet,btcnst_yallabet77,btcnst_holiganbet,btcnst_megabahis,btcnst_5plusbet6,btcnst_kavbet,btcnst_joybet,btcnst_ivocasino,btcnst_betcrazy,btcnst_cokbet,btcnst_vbettr,btcnst_campeonbet,btcnst_mrbet,btcnst_spincity,btcnst_grandbetting,btcnst_yapbahsini1,btcnst_syrgames,btcnst_milionbet,btcnst_anadolubahis,btcnst_betasus75,btcnst_10x10bet,btcnst_galabet,btcnst_bixbet,btcnst_edobetcom,btcnst_queenbet,btcnst_asyabahis,btcnst_adiosbet,btcnst_yorkbet,btcnst_liiratbet,btcnst_kingbetting,btcnst_time4bets,btcnst_campeonbbet,btcnst_sky12betcom,btcnst_rotabet,btcnst_betcart,btcnst_kalebet,btcnst_vbetde,btcnst_betbullde,btcnst_betget,btcnst_gamebet,btcnst_legolas,btcnst_vbetcom,btcnst_vbetnet,btcnst_vivaroam,btcnst_pinbahis,kirsikka,ext_zigzag777,ext_trbet,casino777be,ext_anonibet,ext_bahsegel,PLAYTECHwinnercasino,playamo,videoslots,betchan,n1casino,dunder,NYX833,BMA,PLAYTECHcalienteclub,NYX240,NYX247,NYX248,iforium_fonbet,dreamz,albert2,isb_aspireglobaluk-prod,wac_sportingtech,PLAYTECHfabulousbingo,NYX649,NYX650,NYX767,NYX768,pinup,s2b_lightcasino,isb_bethard-prod,novusbet,dench_sinners,PLAYTECHeuropa,JP,tnls_casinobarcelona,PLAYTECHtropez,fresh,isb_stoiximanro-prod,guts,rizk,kaboo,casinocalzone,isb_aspirecom-prod,isb_aspireglobaldk-prod,NYX974,NYX977,NYX976,NYX1090,roxcasino,AX,NYX924,mbit,wildtornado,NYX683,twincasino,isb_betclic-prod,isb_casino777es-prod,luckystreak-KlasGaming,luckystreak-NArt,ext_casinoslot,enracha.es,NYX800,PLAYTECHsunbingo,drmbx_dreambox,iforium_novibet,NYX831,fortunejack,g1_circusbe,sol,videoslots-uk,princess,spinia,tnls_ijuegoes,videoslots-de,videoslots-ie,videoslots-at,mgops_mrgreenops,tnls_casinogranmadrid,LL1,getwin,jetwin,luckydays,NYX1204,gutsuk,rizkuk,kaboouk,casinocalzoneuk,dunderuk,dreamzuk,pphypintegration,dench_winluducom,s2b_zulabetmga,gt_casinomia,PLAYTECHsunvegas,maneki,slotwolf,ENG,LVT,brazino,wazobet,malinacasino,burancasino,yoyocasino,s2b_zetcasino,boaboa,s2b_cadoola,s2b_wazamba,casinia,s2b_casiniabet,s2b_malinasports,s2b_campobet,s2b_librabet,s2b_alfcasino,s2b_nomini,s2b_rabona,NYX950,PLAYTECHcasino.com2,PLAYTECHmansion,LL,xc_prod_sc_ro,xc_prod_ft_com,xc_prod_ft_eu,xc_prod_ft_uk,xc_prod_ft_dk,xc_prod_ft_es,xc_prod_ft_ro,xc_prod_vg_eu,xc_prod_vg_uk,xc_prod_vg_dk,xc_prod_vg_es,xc_prod_vg_ro,xc_prod_sb_com,xc_prod_sb_eu,xc_prod_sb_uk,xc_prod_sb_dk,xc_prod_sb_es,xc_prod_sb_ro,xc_prod_ps_bg,xc_prod_ft_bg,xc_prod_sc_bg,xc_prod_bs_bg,xc_prod_vg_bg,xc_prod_sb_bg,xc_prod_bs_com,xc_prod_bs_eu,xc_prod_bs_uk,xc_prod_bs_dk,xc_prod_bs_ro,xc_prod_bs_es,xc_prod_vg_com,xc_prod_ps_com,xc_prod_ps_eu,xc_prod_ps_uk,xc_prod_ps_dk,xc_prod_ps_es,xc_prod_ps_ro,xc_prod_sc_com,xc_prod_sc_eu,xc_prod_sc_uk,xc_prod_sc_dk,xc_prod_sc_es".split(",");
	for (var i = 0; i < styleNameList.length; i++)
	{
		if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
		{
			shouldEnable = true;
			break;
		}
	}

	if (!shouldEnable)
		return;
	
	if (window["globalRuntime"] != undefined && (window["globalRuntime"].sceneRoots.length > 1))
	{
		if (window["TournamentVars"] != undefined)
		{
			XT.SetBool(TournamentVars.PrizeDropManuallyCredited, true);
			var cachedLabels = [];
			var cachedBackgroundTransforms = [];
			var OnXTGameInit = function()
			{
				var frbPathsDesktop = [
					"UI Root/XTRoot/Root/GUI/Interface/Windows/BonusRoundsWindows/BonusRoundsFinishedWindow",
					"UI Root/XTRoot/Root/GUI/Interface/Windows/BonusRoundsWindows/TimedBonusRoundsFinishedWindow",
				];

				var frbPathsLandscape = [
					"UI Root/XTRoot/Root/GUI_mobile/Interface_Landscape/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsFinishedWindow",
					"UI Root/XTRoot/Root/GUI_mobile/Interface_Landscape/ContentInterface/Windows/BonusRoundsWindows/TimedBonusRoundsFinishedWindow",
				];

				var frbPathsPortrait = [
					"UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/BonusRoundsWindows/BonusRoundsFinishedWindow",
					"UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/BonusRoundsWindows/TimedBonusRoundsFinishedWindow",
				];

				var manuallyCreditedPathsDesktop = "UI Root/XTRoot/Root/GUI/Tournament/Tournament/PromotionsAnnouncer/ContentWin/ContentAnimator/Content/Europe/AG/ManuallyCredited/YouWillBeCreditedLabel";
				var manuallyCreditedPathsLandscape = "UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/ContentWin/ContentAnimator/Content/Europe/Land/AG/Texts/ManuallyCredited";
				var manuallyCreditedPathsPortrait = "UI Root/XTRoot/Root/GUI_mobile/Tournament/PromotionsAnnouncer/ContentWin/ContentAnimator/Content/Europe/Port/AG/Texts/ManuallyCredited";

				var root = globalRuntime.sceneRoots[1];

				if (!Globals.isMobile)
				{
					for (var i = 0; i < frbPathsDesktop.length; ++i)
					{
						var t = root.transform.Find(frbPathsDesktop[i]);
						if (t != null)
						{
							for (var j = 0; j < t.children.length; j++)
							{
								if (t.children[j].gameObject.name == "Background" || t.children[j].gameObject.name == "BackgroundDDW")
								{
									cachedBackgroundTransforms.push(["desk", t.children[j].transform]);

									var label = root.transform.Find(manuallyCreditedPathsDesktop);
									if (label != null)
										label = label.gameObject;
									else
										continue;
									label.SetActive(false);
									var newObj = instantiate(label);
									newObj.transform.SetParent(t, true);
									newObj.transform.localPosition(new UHTMath.Vector3(0,-265,0));
									newObj.transform.localScale(UHTMath.Vector3.one);
									cachedLabels.push(newObj);
									label.SetActive(true);
								}
							}
						}
					}
				}
				else
				{
					for (var i = 0; i < frbPathsLandscape.length; ++i)
					{
						var t = root.transform.Find(frbPathsLandscape[i]);
						if (t != null)
						{
							for (var j = 0; j < t.children.length; j++)
							{
								if (t.children[j].gameObject.name == "Background" || t.children[j].gameObject.name == "BackgroundDDW")
								{
									cachedBackgroundTransforms.push(["land", t.children[j].transform]);

									var label = root.transform.Find(manuallyCreditedPathsLandscape);
									if (label != null)
										label = label.gameObject;
									else
										continue;
									label.SetActive(false);
									var newObj = instantiate(label);
									newObj.transform.SetParent(t, true);
									newObj.transform.localPosition(new UHTMath.Vector3(0,-312,0));
									newObj.transform.localScale(UHTMath.Vector3.one);
									cachedLabels.push(newObj);
									label.SetActive(true);
								}
							}
						}
					}

					for (var i = 0; i < frbPathsPortrait.length; ++i)
					{
						var t = root.transform.Find(frbPathsPortrait[i]);
						if (t != null)
						{
							for (var j = 0; j < t.children.length; j++)
							{
								if (t.children[j].gameObject.name == "Background" || t.children[j].gameObject.name == "BackgroundDDW")
								{
									cachedBackgroundTransforms.push(["port", t.children[j].transform]);

									var label = root.transform.Find(manuallyCreditedPathsPortrait);
									if (label != null)
										label = label.gameObject;
									else
										continue;
									label.SetActive(false);
									var newObj = instantiate(label);
									newObj.transform.SetParent(t, true);
									newObj.transform.localPosition(new UHTMath.Vector3(0,-1090,0));
									newObj.transform.localScale(UHTMath.Vector3.one);
									cachedLabels.push(newObj);
									label.SetActive(true);
								}
							}
						}
					}
				}
			};

			var OnBonusPromoRoundType = function(param)
			{
				for (var i = 0; i < cachedLabels.length; i++)
				{
					cachedLabels[i].SetActive(!(param == ""));	
				}

				for (var j = 0; j < cachedBackgroundTransforms.length; j++)
				{
					var scale = cachedBackgroundTransforms[j][1].localScale();
					var pos = cachedBackgroundTransforms[j][1].localPosition();
					if (param == "")
					{
						cachedBackgroundTransforms[j][1].localScale(scale.x, 1, scale.z);
						cachedBackgroundTransforms[j][1].localPosition(pos.x, 0, pos.z);
					}
					else
					{
						if (cachedBackgroundTransforms[j][0] == "desk" || cachedBackgroundTransforms[j][0] == "land")
						{
							cachedBackgroundTransforms[j][1].localScale(scale.x, 1.05, scale.z);
							cachedBackgroundTransforms[j][1].localPosition(pos.x, -18, pos.z);
						}
						else
						{
							cachedBackgroundTransforms[j][1].localScale(scale.x, 1.025, scale.z);
							cachedBackgroundTransforms[j][1].localPosition(pos.x, -18, pos.z);
						}
					}
				}
			};

			XT.RegisterCallbackEvent(Vars.Evt_Internal_GameInit, OnXTGameInit, this);
			XT.RegisterCallbackString(Vars.BonusRoundPromoType, OnBonusPromoRoundType, this);

		}
	}
	else
	{
		timeoutEnablePrizeDropManuallyCredited = setTimeout(EnablePrizeDropManuallyCredited, 100);
	}
}
EnablePrizeDropManuallyCredited();

var timeoutPatchiOSLabelMultipleLayers = null;
function PatchiOSLabelMultipleLayers()
{
	if (timeoutPatchiOSLabelMultipleLayers != null)
		clearTimeout(timeoutPatchiOSLabelMultipleLayers);
		
	if (window["LabelMultipleLayers"] == undefined)
	{
		timeoutPatchiOSLabelMultipleLayers = setTimeout(PatchiOSLabelMultipleLayers, 100);
		return;
	}

	if ((window["safari"] != undefined) || (document.documentElement.className.indexOf("iOS") >= 0 && document.documentElement.className.indexOf("MobileSafari") >= 0))
	{
		var oLM_UT = LabelMultipleLayers.prototype.UpdateText;
		LabelMultipleLayers.prototype.UpdateText = function()
		{
			navigator.isCocoonJS = true;
			var oldWindowSafari = window["safari"];
			window["safari"] = {};
			oLM_UT.apply(this, arguments);
			navigator.isCocoonJS = false;
			window["safari"] = oldWindowSafari;
		}
	}
}
PatchiOSLabelMultipleLayers();

var timeoutPatchiOSStandaloneDisableFullscreen = null;
function PatchiOSStandaloneDisableFullscreen()
{
	if (timeoutPatchiOSStandaloneDisableFullscreen != null)
		clearTimeout(timeoutPatchiOSStandaloneDisableFullscreen);
	
	if (window["IPhone8Helper"] == undefined || window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchiOSStandaloneDisableFullscreen = setTimeout(PatchiOSStandaloneDisableFullscreen, 100);
		return;
	}

	var shouldDisable = false;
	var styleNameList = "isb,isb_netbetit-prod,isb_netbetcouk-prod,isb_netbetro-prod,1xbet,betb2b_betandyou,betb2b_fansportcom,betb2b_retivabet,betb2b_allnewgclub,betb2b_astekbet,betb2b_betwinner,betb2b_casinoz,betb2b_dbbet,betb2b_megapari,betb2b_oppabet,betb2b_gyzylburgutbet,betb2b_sapphirebet,betb2b_melbet,betb2b_play595,1xbet_1xbit,betb2b_aznbet,1xbet_sw,betb2b_sprutcasino,betb2b_1xslot,betb2b_22bet".split(",");
	for (var i = 0; i < styleNameList.length; i++)
	{
		if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
		{
			shouldDisable = true;
			break;
		}
	}

	if (navigator.standalone || shouldDisable)
	{
		IPhone8Helper.prototype.GameStarted = function(){return false};
	}
}
PatchiOSStandaloneDisableFullscreen();

var timeoutPatchDisableTurboSpin = null;
function PatchDisableTurboSpin()
{
	if (timeoutPatchDisableTurboSpin != null)
		clearTimeout(timeoutPatchDisableTurboSpin);
	
	if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutPatchDisableTurboSpin = setTimeout(PatchDisableTurboSpin, 100);
		return;
	}

	var shouldDisable = false;
	var styleNameList = "iforium_williamhill,iforium_willhilles,iforium_williamhilles,iforium,NYX1287,NYX897".split(",");
	for (var i = 0; i < styleNameList.length; i++)
	{
		if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
		{
			shouldDisable = true;
			break;
		}
	}
	if (UHT_GAME_CONFIG.STYLENAME.indexOf("gsys_gamesys") > -1)
		shouldDisable = true;
	
	if (UHT_GAME_CONFIG.GAME_SYMBOL != undefined && UHT_GAME_CONFIG.GAME_SYMBOL.substr(0,2) != "vs")
		return;
	
	if (window["XT"] == undefined || !window["XT"]["RegisterAndInitDone"] || ServerOptions.jurisdiction == null)
	{
		timeoutPatchDisableTurboSpin = setTimeout(PatchDisableTurboSpin, 100);
		return;
	}

	if (IsRequired("NOTS"))
		shouldDisable= true;
	
	if (!shouldDisable)
		return;

	var OnXTContinuousSpinChanged = function(/**boolean*/ isContinuousSpin)
	{
		if (isContinuousSpin)
			XT.SetBool(Vars.ContinuousSpin, false);
	};

	var OnXTGameInit = function()
	{
		if (Globals.isMobile)
		{
			var autoplay = window["AutoplayControllerMobile"] ? globalRuntime.sceneRoots[1].GetComponentsInChildren(AutoplayControllerMobile, true) : [];
			for (var i = 0; i < autoplay.length; ++i)
			{
				var turboSpin = autoplay[i].transform.Find("Content/Checkboxes/TurboSpin");
				if (turboSpin != null)
					turboSpin.gameObject.SetActive(false);
			}

			var interfaces = window["InterfaceControllerMobile_1"] ? globalRuntime.sceneRoots[1].GetComponentsInChildren(InterfaceControllerMobile_1, true) : [];
			for (var i = 0; i < interfaces.length; ++i)
			{
				var holdForTurbo = interfaces[i].transform.Find("ContentInterface/DynamicContent/AnchoredRight/Normal/SpinButtons/StartSpin_Button/HoldToAutoplay");
				if (holdForTurbo != null)
					holdForTurbo.gameObject.SetActive(false);
			}

			interfaces = window["InterfaceControllerMobile_2"] ? globalRuntime.sceneRoots[1].GetComponentsInChildren(InterfaceControllerMobile_2, true) : [];
			for (var i = 0; i < interfaces.length; ++i)
			{
				var holdForTurbo = interfaces[i].transform.Find("ContentInterface/DynamicContent/ContentScale/Normal/SpinButtons/StartSpin_Button/HoldToAutoplay");
				if (holdForTurbo != null)
					holdForTurbo.gameObject.SetActive(false);
			}
		}
		else
		{
			var autoplay = window["AutoplayControllerMobile"] ? globalRuntime.sceneRoots[1].GetComponentsInChildren(AutoplayControllerMobile, true) : [];
			for (var i = 0; i < autoplay.length; ++i)
			{
				var turboSpin = autoplay[i].transform.Find("Content/Checkboxes/TurboSpin");
				if (turboSpin != null)
					turboSpin.gameObject.SetActive(false);
			}
		}

		var advancedAutoplay = window["AutoplayControllerAdvanced"] ? globalRuntime.sceneRoots[1].GetComponentsInChildren(AutoplayControllerAdvanced, true) : [];
		for (var i = 0; i < advancedAutoplay.length; ++i)
		{
			var turboSpin = advancedAutoplay[i].transform.Find("Checkboxes/TurboSpin");
			if (turboSpin != null)
				turboSpin.gameObject.SetActive(false);
			
			turboSpin = advancedAutoplay[i].transform.Find("Clipped/Content/Checkboxes/TurboSpin");
			if (turboSpin != null)
				turboSpin.gameObject.SetActive(false);
		}

		var quickSpinWindow = window["QuickSpinWindowController"] ? globalRuntime.sceneRoots[1].GetComponentsInChildren(QuickSpinWindowController, true) : [];
		for (var i = 0; i < quickSpinWindow.length; ++i)
			quickSpinWindow[i].disableWindow.Start();
	};

	var OnXTContinuousSpinChanged = function(/**boolean*/ isContinuousSpin)
	{
		if (isContinuousSpin)
			XT.SetBool(Vars.ContinuousSpin, false);
	};

	XT.RegisterCallbackEvent(Vars.Evt_Internal_GameInit, OnXTGameInit, this);
	XT.RegisterCallbackBool(Vars.ContinuousSpin, OnXTContinuousSpinChanged, this);
	if (!Globals.isMobile)
	{
		if (window["GUIMessageTurboSpin"] != undefined)
			GUIMessageTurboSpin.prototype.Show = function()
			{
				if (this.messages!= null && this.messages.length > 0)
				{
					var i = Random.Range(0, this.messages.length);
					this.label.text = this.messages[i];
				}
			
				this.gameObject.SetActive(true);
			};
	}
}
PatchDisableTurboSpin();

var timeoutDisableHomeButtonMiniMode = null;
function DisableHomeButtonMiniMode()
{
	if (timeoutDisableHomeButtonMiniMode != null)
		clearTimeout(timeoutDisableHomeButtonMiniMode);
	
	if (window["UHT_GAME_CONFIG"] == undefined)
	{
		timeoutDisableHomeButtonMiniMode = setTimeout(DisableHomeButtonMiniMode, 100);
		return;
	}

	var shouldDisable = false;
	var styleNameList = "mnsn_m88,mnsn_happy8,mnsn_happy8stg,mnsn_m88stg,mnsn_happy8rc,mnsn_m88rc".split(",");
	for (var i = 0; i < styleNameList.length; i++)
	{
		if (UHT_GAME_CONFIG.STYLENAME == styleNameList[i])
		{
			shouldDisable = true;
			break;
		}
	}
	if (UHT_GAME_CONFIG.STYLENAME.indexOf("weinet_") > -1)
		shouldDisable = true;

	if (!shouldDisable)
		return;
	
	if (window["globalRuntime"] != undefined && (window["globalRuntime"].sceneRoots.length > 1))
	{
        if (Globals.isMini)
        {
            var homeButtonPath = "UI Root/XTRoot/Root/GUI_mobile/Interface_Portrait/ContentInterface/Windows/MenuWindow/Content/Home";
            var gameRoot = globalRuntime.sceneRoots[1];

            var t = gameRoot.transform.Find(homeButtonPath);
            if (t != null)
                t.gameObject.SetActive(false);
			XT.SetBool(Vars.Jurisdiction_GameLobbyInfoVisible, false);
        }
	}
	else
	{
		timeoutDisableHomeButtonMiniMode = setTimeout(DisableHomeButtonMiniMode, 100);
	}
}
DisableHomeButtonMiniMode();

var timeoutPatchMBUV = null;
function PatchMBUV()
{
	if (timeoutPatchMBUV != null)
		clearTimeout(timeoutPatchMBUV);
    
    if (window["MenuButton"] == undefined)
	{
		timeoutPatchMBUV = setTimeout(PatchMBUV, 100);
		return;
	}
	MenuButton.prototype.UpdateValue = function(uil, uis) {
        this.label.text = uil.text;
        this.label.fontName = uil.fontName;
        this.label.Prepare();
        GUIArranger.I.CopySprite(uis, this.icon);
        GUIArranger.I.CopySpriteSize(uis, this.icon);
        var uibuttons = this.button.gameObject.GetComponents(UIButton);
        for (var i = 0; i < uibuttons.length; i++)
            if (uibuttons[i].target == this.icon)
                uibuttons[i].normal = uis.spriteName
    }

	
}
PatchMBUV();
