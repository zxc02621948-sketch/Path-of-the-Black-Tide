// Combat rules used by Game.
const CombatRules = {
  resolveRound({ attacker, enemy, squad, rollResult, combatMods, resonanceAttackBonus, intent, round, suppressEnemyAction = false, deferEnemyAction = false, allowNativeWeaknessEffect = true, eagleFeatherDamageBonus = 0, eagleFeatherNativeCandidate = false, starHunterEyeDamageBonus = 0, bowFollowUpDamageBonus = 0, starBreakerActive = false, wagerDice = null, battleDrumAttackBonus = 0, banner = null, supportTacticalDamageBonus = 0, supportTacticalDamageReduce = 0 }) {
    const rawRoll = rollResult.value;
    const diceRaw = rollResult.raw ?? rollResult.value;
    const logs = [];
    const banners = Array.isArray(banner) ? banner.filter(Boolean) : (banner ? [banner] : []);

    const weapon = attacker.weapon;
    const weaponLabel = weapon ? `${weapon.icon} ${weapon.name}` : '徒手';
    logs.push(`主戰：${attacker.name}（${weaponLabel}）`);

    const supporters = squad.filter(c => c.id !== attacker.id && c.hp > 0 && !c.dead && c.gear);
    for (const c of supporters) {
      const gearType = c.gear.effect?.type;
      logs.push(`支援 ${c.name}：${c.gear.icon} ${c.gear.name}`);
    }

    const telescopeActive = supporters.some(c => c.gear.effect?.type === 'add_temp_weakness');
    if (telescopeActive && CombatStatus.tempWeaknesses(enemy, 'normal').length === 0) {
      const value = this._nextTempWeakness(enemy, enemy.weakness);
      if (value) {
        CombatStatus.setTempWeakness(enemy, value, { source: 'normal' });
        logs.push(`望遠鏡：敵人增加破綻 ${value}`);
      } else {
        logs.push('望遠鏡：沒有可用骰面產生破綻');
      }
    }

    const exposedFloor = enemy.exposed ? 2 : 0;
    const relicFloor = this._relicCombatFloor(attacker);
    const adjustedBase = Math.max(rawRoll, exposedFloor, relicFloor);
    const equipAttackBonus = (combatMods || [])
      .filter(m => m.type === 'attack_bonus')
      .reduce((sum, m) => sum + m.value, 0);
    const maxRoll = rollResult.sides || 6;
    let roll = Math.min(maxRoll, adjustedBase + (resonanceAttackBonus || 0) + equipAttackBonus);

    if (rollResult.dodecaFateDice) logs.push(`十二面命運骰：${attacker.name} 的攻擊骰改為 1d12。`);
    if (rollResult.dodecaLuckyDice) logs.push(`十二面幸運骰：${attacker.name} 的攻擊骰改為 1d12，且不會命中原生弱點。`);
    if (rollResult.boneDiceBagAdjusted) {
      logs.push(`骨骰袋低骰補正：${rollResult.boneDiceBagAdjusted.from} 改為 ${rollResult.boneDiceBagAdjusted.to}`);
    }
    if (rollResult.floored) logs.push(`骰面 ${diceRaw} 結算為 ${rawRoll}`);
    if (relicFloor > rawRoll) logs.push(`聖物保底：戰鬥骰最低 ${relicFloor}`);
    if (resonanceAttackBonus > 0) logs.push(`共鳴攻擊骰 +${resonanceAttackBonus}`);
    if (equipAttackBonus > 0) logs.push(`道具攻擊骰 +${equipAttackBonus}`);

    const greatswordResonance = (typeof G !== 'undefined' ? (G.activeResonances || []) : [])
      .find(res => res?.effect?.type === 'greatsword_resonance' && res?.bodyChar?.id === attacker.id) || null;
    const rapierResonance = (typeof G !== 'undefined' ? (G.activeResonances || []) : [])
      .find(res => res?.effect?.type === 'rapier_resonance' && res?.bodyChar?.id === attacker.id) || null;
    const greatswordRelic = rapierResonance ? null : [attacker.relic, attacker.fusedRelic]
      .find(relic => relic?.effect?.type === 'greatsword_stance') || null;
    const rapierRelic = greatswordResonance ? null : [attacker.relic, attacker.fusedRelic]
      .find(relic => relic?.effect?.type === 'rapier_stance') || null;
    const greatswordMomentum = Math.max(0, attacker._greatswordMomentum || 0);
    const baseAttack = (attacker.attack || 0) + (battleDrumAttackBonus || 0) + greatswordMomentum;
    if (battleDrumAttackBonus > 0) logs.push(`戰鼓：主戰者攻擊 +${battleDrumAttackBonus}`);
    if (greatswordMomentum > 0) logs.push(`氣勢：${attacker.name} 基礎攻擊 +${greatswordMomentum}`);
    const diceDamageRate = weapon?.effect?.type === 'battle_drum'
      ? (weapon.effect.diceDamageRate ?? 0.5)
      : 1;
    const diceDamage = Math.floor(roll * diceDamageRate);
    let damage = this._calculateDamage(baseAttack, diceDamage);
    if (diceDamageRate < 1) {
      logs.push(`戰鼓：骰面附加傷害減半，${roll} → ${diceDamage}`);
    }
    logs.push(`骰面 ${diceDamage} + 攻擊 ${baseAttack} = 傷害 ${damage}`);

    if (eagleFeatherDamageBonus > 0) {
      damage += eagleFeatherDamageBonus;
      logs.push(`鷹眼羽飾融合：本次追擊傷害 +${eagleFeatherDamageBonus}`);
    }
    if (starHunterEyeDamageBonus > 0) {
      damage += starHunterEyeDamageBonus;
      logs.push(`獵星之眼：弓的追加攻擊傷害 +${starHunterEyeDamageBonus}`);
    }
    if (bowFollowUpDamageBonus > 0) {
      damage += bowFollowUpDamageBonus;
      logs.push(`${weapon.name}：追加攻擊傷害 +${bowFollowUpDamageBonus}`);
    }
    if (supportTacticalDamageBonus > 0 && damage > 0) {
      damage += supportTacticalDamageBonus;
      logs.push(`輔助戰術支援：本回合首次攻擊傷害 +${supportTacticalDamageBonus}`);
    }

    const luckyStar = attacker.fusedRelic?.effect?.type === 'lucky_star'
      ? attacker.fusedRelic
      : (attacker.relic?.effect?.type === 'lucky_star' ? attacker.relic : null);
    const luckyStarImmuneGamblerPenalty = !!luckyStar && (
      (luckyStar.effect?.forcedSixImmuneGamblerPenalty && rollResult.luckyStarForced && roll === 6) ||
      (luckyStar.effect?.finalSixTwelveImmuneGamblerPenalty && (roll === 6 || roll === 12))
    );
    if (luckyStar && roll === 6) {
      const bonus = luckyStar.effect.sixDamageBonus || 2;
      damage += bonus;
      logs.push(`幸運星：攻擊骰結果為 6，傷害 +${bonus}`);
    } else if (luckyStar && roll === 12) {
      const bonus = luckyStar.effect.twelveDamageBonus || 4;
      damage += bonus;
      logs.push(`幸運星融合：攻擊骰結果為 12，傷害 +${bonus}`);
    }

    if (wagerDice?.active && wagerDice.charId === attacker.id && Array.isArray(wagerDice.faces)) {
      const wagerHit = wagerDice.faces.includes(roll);
      if (wagerHit) {
        const bonus = wagerDice.damageBonus || 4;
        damage += bonus;
        logs.push(`賭命骰子：押中 ${roll}，本擊傷害 +${bonus}`);
      } else {
        const maxStacks = wagerDice.maxMissStacks || 3;
        const { before, after } = CombatStatus.addRemorse(attacker, 1, {
          maxStacks,
          rate: wagerDice.missPenaltyRate || 0.30,
        });
        logs.push(`賭命骰子：${roll} 未命中押注，懊悔 ${before} → ${after} 層`);
      }
    }

    let stunned = false;
    CombatStatus.nativeWeaknesses(enemy, 'extra');
    CombatStatus.setTempWeaknesses(enemy, CombatStatus.tempWeaknesses(enemy, 'gambler'), { source: 'gambler' });

    CombatStatus.disabledNativeWeaknesses(enemy);
    for (const activeBanner of banners) {
      if (suppressEnemyAction || activeBanner.faceType !== 'eagle_temp_weakness' || activeBanner.usedThisRound) continue;
      const value = this._nextTempWeakness(enemy, 0, [], { eagle: true });
      activeBanner.usedThisRound = true;
      if (value) {
        this._setEagleWeakness(enemy, { kind: 'temp', value, round });
        logs.push(`${activeBanner.name}・${activeBanner.faceName}：敵人獲得鷹眼破綻 ${value}`);
      } else {
        logs.push(`${activeBanner.name}・${activeBanner.faceName}：沒有可用骰面產生鷹眼破綻`);
      }
    }
    const activeNativeWeaknesses = CombatStatus.nativeWeaknesses(enemy, 'enemy');
    const allowFinalNativeWeakness = !rollResult.dodecaLuckyDice;
    let realWeaknessHit = allowFinalNativeWeakness && (
      activeNativeWeaknesses.includes(diceRaw) ||
      activeNativeWeaknesses.includes(roll)
    );
    let grapplingHookAssisted = false;
    const tempWeaknesses = CombatStatus.tempWeaknesses(enemy);
    let luckyTempMultipleHits = rollResult.dodecaLuckyDice
      ? tempWeaknesses.filter(w => w > 0 && roll % w === 0)
      : [];
    let tempWeaknessHit = !realWeaknessHit && (tempWeaknesses.includes(roll) || luckyTempMultipleHits.length > 0);
    let resonanceWeaknessSource = rollResult.dodecaFateDice && allowFinalNativeWeakness
      ? activeNativeWeaknesses.find(w => roll === w * 2)
      : null;
    let resonanceWeaknessHit = !!resonanceWeaknessSource;
    let suspiciousFlawSource = null;
    if (!realWeaknessHit && allowFinalNativeWeakness && attacker.cls === 'explorer' && enemy.suspiciousFlaw) {
      suspiciousFlawSource = activeNativeWeaknesses.find(w => Math.abs(roll - w) === 1 || Math.abs(diceRaw - w) === 1);
      if (suspiciousFlawSource) {
        enemy.suspiciousFlaw = false;
        realWeaknessHit = true;
        logs.push(`可疑弱點：${attacker.name} 消耗標記，差 1 視為命中原生弱點 ${suspiciousFlawSource}`);
      }
    }
    const canUseGrapplingHook = attacker.gear?.effect?.type === 'grappling_hook' &&
      !attacker._grapplingHookUsedRound &&
      roll < maxRoll &&
      !realWeaknessHit &&
      !tempWeaknessHit &&
      !resonanceWeaknessHit;
    if (canUseGrapplingHook) {
      const beforeHook = roll;
      roll = Math.min(maxRoll, roll + (attacker.gear.effect.value || 1));
      attacker._grapplingHookUsedRound = true;
      grapplingHookAssisted = true;
      rollResult.grapplingHookAdjusted = { from: beforeHook, to: roll };
      rollResult.displayValue = roll;
      rollResult.floored = true;
      logs.push(`${attacker.gear.name}：未命中弱點，攻擊骰面 ${beforeHook} → ${roll}`);
      realWeaknessHit = allowFinalNativeWeakness && activeNativeWeaknesses.includes(roll);
      luckyTempMultipleHits = rollResult.dodecaLuckyDice
        ? tempWeaknesses.filter(w => w > 0 && roll % w === 0)
        : [];
      tempWeaknessHit = !realWeaknessHit && (tempWeaknesses.includes(roll) || luckyTempMultipleHits.length > 0);
      resonanceWeaknessSource = rollResult.dodecaFateDice && allowFinalNativeWeakness
        ? activeNativeWeaknesses.find(w => roll === w * 2)
        : null;
      resonanceWeaknessHit = !!resonanceWeaknessSource;
    }
    const gamblerTempWeaknessHit = !rollResult.dodecaLuckyDice && !realWeaknessHit && !tempWeaknessHit &&
      !!(enemy.gamblerTempWeakness && roll === enemy.gamblerTempWeakness);
    const eagleFeatherNativeHit = !!eagleFeatherNativeCandidate && allowFinalNativeWeakness && !realWeaknessHit && weapon?.effect?.type === 'bow_followup';
    const nativeWeaknessFace = suspiciousFlawSource || (activeNativeWeaknesses.includes(roll) ? roll : diceRaw);
    const weaknessHit = realWeaknessHit || eagleFeatherNativeHit || resonanceWeaknessHit || tempWeaknessHit || gamblerTempWeaknessHit;
    let starBreakerFixedDamage = 0;

    const applyNativeWeaknessEffect = (prefix = '弱點') => {
      const result = WeaknessEffects.apply({
        enemy,
        squad,
        logs,
        round,
        prefix,
        nativeWeaknessFace,
      });
      if (result.stunned) stunned = true;
      return result.effect;
    };

    if (realWeaknessHit) {
      const eff = allowNativeWeaknessEffect ? applyNativeWeaknessEffect('原生弱點') : (enemy.weaknessEffect || {});
      damage += 3;
      logs.push(allowNativeWeaknessEffect
        ? `命中原生弱點 ${nativeWeaknessFace}：${eff.desc || ''}，傷害 +3`
        : `追擊命中原生弱點 ${nativeWeaknessFace}：不觸發破除效果，傷害 +3`);

      const lens = attacker.fusedRelic?.effect?.type === 'flaw_lens'
        ? attacker.fusedRelic
        : (attacker.relic?.effect?.type === 'flaw_lens' ? attacker.relic : null);
      if (lens?.effect?.fusedWeaknessDamage && damage > 0) {
        damage += lens.effect.fusedWeaknessDamage;
        logs.push(`鷹眼透鏡融合：命中原生弱點，傷害 +${lens.effect.fusedWeaknessDamage}`);
      }
      if (lens && !attacker._flawLensUsed) {
        const guaranteed = !!lens.effect.guaranteed;
        const success = guaranteed || Math.random() < (lens.effect.chance ?? 0.5);
        if (success) {
          const added = this._nextNativeWeakness(enemy, nativeWeaknessFace);
          if (added) {
            attacker._flawLensUsed = true;
            CombatStatus.addExtraNativeWeakness(enemy, added, { source: 'flaw_lens' });
            logs.push(`鷹眼透鏡：敵人新增原生弱點 ${added}`);
          } else {
            attacker._flawLensUsed = true;
            logs.push('鷹眼透鏡：沒有可用骰面新增原生弱點');
          }
        } else {
          logs.push('鷹眼透鏡：未能看穿新的原生弱點，下次命中原生弱點時可再嘗試');
        }
      }
      if (enemy.eagleNativeWeakness?.source === 'star_hunter_eye' && enemy.eagleNativeWeakness.value === nativeWeaknessFace) {
        CombatStatus.setEagleNativeWeakness(enemy, null);
        const nextStarHunterWeakness = this._nextEagleWeakness(enemy, nativeWeaknessFace);
        if (nextStarHunterWeakness) {
          this._setEagleWeakness(enemy, {
            kind: 'native',
            value: nextStarHunterWeakness,
            duration: null,
            round,
            source: 'star_hunter_eye',
          });
          logs.push(`獵星之眼：命中鷹眼暫時原生弱點 ${nativeWeaknessFace}，改為 ${nextStarHunterWeakness}。`);
        } else {
          logs.push('獵星之眼：鷹眼暫時原生弱點已被命中，但沒有可用骰面改寫。');
        }
      }
      if (starBreakerActive && !rollResult.starHunterForceSixNoWeakness && weapon?.effect?.type === 'bow_followup') {
        if (this._shatterNativeWeakness(enemy, nativeWeaknessFace)) {
          starBreakerFixedDamage += 10;
          logs.push(`裂星破滅：破壞原生弱點 ${nativeWeaknessFace}，造成 10 點固定傷害`);
        } else {
          logs.push('裂星破滅：沒有可破壞的原生弱點。');
        }
      }
      if (!suppressEnemyAction) {
        const rearNativeBonus = supporters
          .filter(c => c.gear?.effect?.type === 'rear_native_damage_bonus')
          .reduce((sum, c) => sum + Math.max(0, c.gear.effect.value || 0), 0);
        if (rearNativeBonus > 0) {
          damage += rearNativeBonus;
          logs.push(`後排標定：命中原生弱點，傷害 +${rearNativeBonus}`);
        }
      }
      for (const activeBanner of banners) {
        const eagleNativeDamage = this._bannerEagleNativeDamage(activeBanner);
        if (eagleNativeDamage <= 0) continue;
        damage += eagleNativeDamage;
        logs.push(`${activeBanner.name}・${activeBanner.faceName}：命中任一原生弱點，傷害 +${eagleNativeDamage}`);
        const duration = this._bannerEagleNativeDuration(activeBanner, roll);
        if (duration > 0) {
          const value = this._nextEagleWeakness(enemy, nativeWeaknessFace);
          if (value) {
            this._setEagleWeakness(enemy, { kind: 'native', value, duration, round });
            logs.push(`${activeBanner.name}・${activeBanner.faceName}：新增鷹眼暫時原生弱點 ${value}，持續 ${duration} 回合`);
          } else {
            logs.push(`${activeBanner.name}・${activeBanner.faceName}：沒有可用骰面新增鷹眼暫時原生弱點`);
          }
        }
      }
    } else if (eagleFeatherNativeHit) {
      logs.push(`鷹眼羽飾：最終骰面 ${roll} 視為命中原生弱點。`);
      if (starBreakerActive && !rollResult.starHunterForceSixNoWeakness && weapon?.effect?.type === 'bow_followup') {
        logs.push('裂星破滅：鷹眼羽飾的視為命中不會破壞原生弱點。');
      }
    } else if (resonanceWeaknessHit) {
      const eff = allowNativeWeaknessEffect ? applyNativeWeaknessEffect('共鳴弱點') : (enemy.weaknessEffect || {});
      logs.push(allowNativeWeaknessEffect
        ? `共鳴弱點：最終骰值 ${roll} = 原生弱點 ${resonanceWeaknessSource} x2，觸發「${eff.desc || ''}」。`
        : `追擊命中共鳴弱點：最終骰值 ${roll} = 原生弱點 ${resonanceWeaknessSource} x2，不觸發破除效果。`);
    } else if (tempWeaknessHit) {
      const bonus = rollResult.dodecaLuckyDice ? 3 : 1;
      damage += bonus;
      logs.push(`命中破綻，傷害 +${bonus}`);
      const eagleTempHit = enemy.eagleTempWeakness && (
        roll === enemy.eagleTempWeakness ||
        (rollResult.dodecaLuckyDice && roll % enemy.eagleTempWeakness === 0)
      );
      const eagleTempBanner = eagleTempHit
        ? banners.find(activeBanner => this._bannerValue(activeBanner, 'eagle_temp_weakness') > 0)
        : null;
      const eagleTempBonus = eagleTempBanner ? this._bannerValue(eagleTempBanner, 'eagle_temp_weakness') : 0;
      if (eagleTempBonus > 0) {
        damage += eagleTempBonus;
        logs.push(`${eagleTempBanner.name}・${eagleTempBanner.faceName}：命中鷹眼破綻，傷害 +${eagleTempBonus}`);
      }
    }

    if (gamblerTempWeaknessHit) {
      logs.push('命中搏命者產生的破綻。');
    }

    if (rollResult.pollutionLocked) {
      logs.push(`污染鎖定：原始骰面 ${rollResult.pollutedFace} 無法被改骰或保底。`);
    }

    const playerDamageState = { damage, pollutionTriggered: false, pollutionHeal: 0, pollutionSelfDamage: 0 };
    EnemyAbilities.beforePlayerDamage(playerDamageState, {
      attacker,
      enemy,
      squad,
      roll,
      rollResult,
      realWeaknessHit,
      weaknessHit,
      allowNativeWeaknessEffect,
      logs,
      round,
    });
    damage = Math.max(0, playerDamageState.damage || 0);
    if (playerDamageState.pollutionTriggered) {
      starBreakerFixedDamage = 0;
    }
    const greatswordStrike = !!greatswordRelic &&
      weapon?.family === 'sword' &&
      roll >= Math.max(1, greatswordRelic.effect?.minRoll || 4) &&
      damage > 0;
    if (greatswordStrike) {
      logs.push(`${greatswordRelic.name}：高骰 ${roll}，本擊視為重劍。`);
      if (greatswordResonance) {
        const per = Math.max(1, greatswordResonance.effect?.damagePerMomentum || 5);
        const bonusEach = Math.max(0, greatswordResonance.effect?.damageBonus || 1);
        const bonus = Math.floor(greatswordMomentum / per) * bonusEach;
        if (bonus > 0) {
          damage += bonus;
          logs.push(`${greatswordResonance.name}：氣勢 ${greatswordMomentum}，重劍傷害 +${bonus}。`);
        }
      }
    }

    const gamblerFace = roll;
    const gamblerEvenBacklash = attacker.cls === 'scholar' && gamblerFace % 2 === 0;
    const dodecaOddRefresh = gamblerFace % 2 === 1 && (attacker.cls === 'scholar' || gamblerFace >= 7);

    if ((rollResult.dodecaFateDice || rollResult.dodecaLuckyDice) && dodecaOddRefresh) {
      if (rollResult.dodecaFateDice) {
        CombatStatus.removeExtraNativeWeakness(enemy, enemy.gamblerNativeWeakness);
        enemy.gamblerNativeWeakness = this._nextNativeWeakness(enemy, gamblerFace);
        if (enemy.gamblerNativeWeakness) {
          CombatStatus.addExtraNativeWeakness(enemy, enemy.gamblerNativeWeakness, { source: 'gambler_native' });
          logs.push(`十二面命運骰：單數 ${gamblerFace}，刷新 1 個原生弱點：${enemy.gamblerNativeWeakness}`);
        } else {
          logs.push(`十二面命運骰：單數 ${gamblerFace}，沒有可用骰面刷新原生弱點`);
        }
      } else {
        const count = attacker.cls === 'scholar' && gamblerFace >= 7 ? 2 : 1;
        CombatStatus.setTempWeaknesses(enemy, this._nextGamblerTempWeaknesses(enemy, gamblerFace, count), { source: 'gambler' });
        logs.push(enemy.gamblerTempWeaknesses.length > 0
          ? `十二面幸運骰：單數 ${gamblerFace}，刷新 ${enemy.gamblerTempWeaknesses.length} 個搏命破綻：${enemy.gamblerTempWeaknesses.join('、')}`
          : `十二面幸運骰：單數 ${gamblerFace}，沒有可用骰面刷新破綻`);
      }
      if (attacker.cls === 'scholar') {
        damage += 1;
        logs.push(`搏命者：單數攻擊，本次傷害 +1`);
      }
    } else if ((rollResult.dodecaFateDice || rollResult.dodecaLuckyDice) && gamblerFace % 2 === 1 && attacker.cls !== 'scholar') {
      logs.push(`十二面骰：非搏命者擲出低單數 ${gamblerFace}，不刷新弱點。`);
    } else if (attacker.cls === 'scholar') {
      if (gamblerFace % 2 === 1) {
        CombatStatus.setTempWeakness(enemy, this._nextGamblerTempWeakness(enemy, gamblerFace), { source: 'gambler' });
        logs.push(enemy.gamblerTempWeakness
          ? `搏命者：單數攻擊，刷新搏命破綻 ${enemy.gamblerTempWeakness}`
          : '搏命者：沒有可用骰面刷新破綻');
        damage += 1;
        logs.push(`搏命者：單數攻擊，本次傷害 +1`);
      } else {
        if (luckyStarImmuneGamblerPenalty) {
          logs.push(`幸運星：${attacker.name} 免疫本次雙數副作用`);
        } else if (rollResult.boneDiceBagSuppressScholarBacklash) {
          logs.push('骨骰袋：本次低骰補正變為偶數，不觸發雙數反噬');
        } else {
          const { before, after } = CombatStatus.addBacklash(attacker, 1, { maxStacks: 3, rate: 0.20 });
          logs.push(`搏命者：雙數反噬，${attacker.name} 反噬 ${before} → ${after} 層`);
        }
      }
    }

    if (weapon?.effect?.type === 'healing_staff') {
      const currentBlock = CombatStatus.getBlock(enemy);
      if (currentBlock > 0) {
        logs.push(`祈癒杖：本次攻擊無視格檔 ${currentBlock}`);
        CombatStatus.clearBlock(enemy);
      }
      if (realWeaknessHit) {
        const heal = weapon.effect.healOnRealWeakness || 1;
        const healed = [];
        for (const char of squad) {
          if (char.dead || char.hp <= 0 || char.hp >= char.maxHp) continue;
          const before = char.hp;
          char.hp = Math.min(char.maxHp, char.hp + heal);
          if (char.hp > before) healed.push(`${char.name} +${char.hp - before}`);
        }
        if (healed.length > 0) logs.push(`祈癒杖：全隊恢復 ${healed.join('、')}`);
      }
    }

    if (weaknessHit && weapon?.effect?.type === 'weakness_bonus') {
      damage += weapon.effect.value;
      logs.push(`匕首：弱點額外 +${weapon.effect.value}，傷害 ${damage}`);
    }
    if (weapon?.effect?.type === 'shadow_fang_dagger') {
      if (weaknessHit) {
        const bonus = weapon.effect.weaknessBonus || 2;
        damage += bonus;
        logs.push(`影牙匕首：命中弱點，額外 +${bonus}，傷害 ${damage}`);
      } else {
        damage += roll;
        logs.push(`影牙匕首：未命中弱點，額外造成最終骰面 ${roll} 傷害，傷害 ${damage}`);
      }
    }

    const dmgBonus = attacker.fusedRelic?.effect?.type === 'combat_damage_bonus'
      ? attacker.fusedRelic.effect.fusedValue
      : (attacker.relic?.effect?.type === 'combat_damage_bonus' ? attacker.relic.effect.value : 0);
    if (dmgBonus > 0 && damage > 0) {
      damage += dmgBonus;
      logs.push(`獸骨頸環：+${dmgBonus}，傷害 ${damage}`);
    }

    if (weapon?.effect?.type === 'damage_bonus' && damage > 0) {
      damage += weapon.effect.value;
      logs.push(`劍：+${weapon.effect.value}，傷害 ${damage}`);
    }
    if (weapon?.effect?.type === 'sword_high_low' && damage > 0) {
      const lowMax = weapon.effect.lowMax || 3;
      const bonus = roll <= lowMax ? (weapon.effect.lowBonus || 0) : (weapon.effect.highBonus || 0);
      if (bonus > 0) {
        damage += bonus;
        logs.push(`${weapon.name}：${roll <= lowMax ? '低骰' : '高骰'} +${bonus}，傷害 ${damage}`);
      }
    }
    if (attacker.gear?.effect?.type === 'edge_face_damage' && damage > 0) {
      const effect = attacker.gear.effect;
      const faces = Array.isArray(effect.faces) ? effect.faces : [];
      if (faces.includes(diceRaw)) {
        const bonus = Math.max(0, effect.damage || 0);
        if (bonus > 0) {
          damage += bonus;
          logs.push(`${attacker.gear.name}：原始骰面 ${diceRaw}，傷害 +${bonus}`);
        }
      }
    }

    if (luckyTempMultipleHits.length > 0 && damage > 0) {
      const bonus = luckyTempMultipleHits.length * 8;
      damage += bonus;
      logs.push(`十二面幸運骰：最終骰值 ${roll} 是破綻 ${luckyTempMultipleHits.join('、')} 的倍數，傷害 +${bonus}`);
    }

    if (rollResult.dodecaFateDice && (realWeaknessHit || eagleFeatherNativeHit || resonanceWeaknessHit) && damage > 0) {
      const multiplier = diceRaw === 12 && resonanceWeaknessHit ? 4 : 3;
      const beforeResonance = damage;
      damage *= multiplier;
      logs.push(diceRaw === 12 && resonanceWeaknessHit
        ? `十二面命運骰爆點：自然 12 且觸發共鳴弱點，最終傷害 ${beforeResonance} x4 = ${damage}`
        : `十二面命運骰：命中原生弱點，最終傷害 ${beforeResonance} x3 = ${damage}`);
    }

    const fusedBlackIronCrown = enemy.darkMonster && enemy.darkMonsterActiveHunt && squad.some(c =>
      c.hp > 0 && !c.dead && c.fusedRelic?.id === 'black_iron_crown'
    );
    if (fusedBlackIronCrown && damage > 0) {
      const bonus = Math.max(1, Math.ceil(damage * 0.10));
      damage += bonus;
      logs.push(`黑鐵冠融合：對黑暗化身傷害 +${bonus}，傷害 ${damage}`);
    }

    const painSplinterBadge = attacker.fusedRelic?.effect?.type === 'wound_damage_bonus'
      ? attacker.fusedRelic
      : (attacker.relic?.effect?.type === 'wound_damage_bonus' ? attacker.relic : null);
    const woundMax = painSplinterBadge?.effect?.woundMax || enemy.woundMax || 15;
    enemy.woundMax = Math.max(enemy.woundMax || 15, woundMax);
    const currentWounds = Math.max(0, Math.min(woundMax, enemy.wounds || 0));
    const painResonanceActive = attacker.fusedRelic?.id === 'pain_mask' && attacker.relic?.id === 'pain_splinter_badge';
    const painMask = attacker.fusedRelic?.effect?.type === 'pain_mask'
      ? attacker.fusedRelic
      : (attacker.relic?.effect?.type === 'pain_mask' ? attacker.relic : null);
    const preSoulCutterDamage = damage;
    let predictedWoundGain = 0;
    if (damage > 0) {
      if (painResonanceActive) predictedWoundGain += Math.max(0, roll || 0);
      if (weapon?.effect?.type === 'wound_on_hit') predictedWoundGain += weapon.effect.stacks || 1;
      const predictedWoundBanner = banners.find(activeBanner =>
        !activeBanner.usedThisRound && this._bannerValue(activeBanner, 'first_hit_wound') > 0
      );
      predictedWoundGain += predictedWoundBanner ? this._bannerValue(predictedWoundBanner, 'first_hit_wound') : 0;
      if (painMask) {
        const step = painMask.effect.damagePerWound || 4;
        const stacksPerStep = painMask.effect.stacksPerStep || 1;
        predictedWoundGain += Math.floor(preSoulCutterDamage / step) * stacksPerStep;
      }
      const predictedSerratedOil = attacker.gear?.effect?.type === 'serrated_oil' ? attacker.gear.effect : null;
      if (predictedSerratedOil && !attacker._serratedOilUsedRound && roll >= (predictedSerratedOil.rollMin || 5)) {
        predictedWoundGain += predictedSerratedOil.stacks || 1;
      }
      if (painSplinterBadge?.effect?.woundOnRoll && roll === painSplinterBadge.effect.woundOnRoll) {
        predictedWoundGain += Math.max(0, painSplinterBadge.effect.woundStacks || 0);
      }
    }
    const explodeAtWounds = painResonanceActive ? 10 : painMask?.effect?.explodeAtWounds;
    const soulCutterWillExplode = !!explodeAtWounds && Math.min(woundMax, currentWounds + predictedWoundGain) >= explodeAtWounds;
    if (weapon?.effect?.type === 'wound_on_hit' && weapon.effect.highWoundDamageBonus && currentWounds >= (weapon.effect.woundThreshold || 8) && damage > 0 && !soulCutterWillExplode) {
      damage += weapon.effect.highWoundDamageBonus;
      logs.push(`${weapon.name}：目標傷口 ${currentWounds} 層，本次傷害 +${weapon.effect.highWoundDamageBonus}`);
    }
    const preWoundDamage = preSoulCutterDamage;
    if (painResonanceActive && currentWounds > 0 && damage > 0) {
      logs.push(`痛痕共鳴・爆發：本次主戰無視傷口 ${currentWounds} 層的傷害加成`);
    }
    if (!painResonanceActive && currentWounds > 0 && damage > 0) {
      let woundBonusRate = currentWounds * 0.05;
      const painScarResonanceActive = attacker.fusedRelic?.id === 'pain_splinter_badge' && attacker.relic?.id === 'pain_mask';
      if (painSplinterBadge && currentWounds >= (painSplinterBadge.effect.threshold || 5)) {
        woundBonusRate += painSplinterBadge.effect.bonusRate || 0.20;
        logs.push(`裂痛徽記：目標傷口 ${currentWounds} 層，傷害額外提高 ${Math.round((painSplinterBadge.effect.bonusRate || 0.20) * 100)}%`);
      }
      const painScarThreshold = 6;
      if (painScarResonanceActive && currentWounds >= painScarThreshold) {
        woundBonusRate += 0.20;
        logs.push(`痛痕共鳴・折磨：目標傷口 ${currentWounds} 層達到 ${painScarThreshold} 層，擊中傷害額外提高 20%`);
      }
      const woundBonus = Math.floor(damage * woundBonusRate);
      if (woundBonus > 0) {
        damage += woundBonus;
        logs.push(`傷口 ${currentWounds} 層：傷害 +${woundBonus}，傷害 ${damage}`);
      } else {
        logs.push(`傷口 ${currentWounds} 層：增傷未達 1 點`);
      }
    }

    if (damage > 0) {
      for (const activeBanner of banners) {
        const bannerDamageBonus = this._bannerValue(activeBanner, 'hit_damage_bonus');
        if (bannerDamageBonus <= 0) continue;
        damage += bannerDamageBonus;
        logs.push(`${activeBanner.name}・${activeBanner.faceName}：擊中傷害 +${bannerDamageBonus}`);
      }
    }

    const preBlockDamage = damage;
    if (CombatStatus.getBlock(enemy) > 0 && damage > 0) {
      const blockResult = CombatStatus.consumeBlock(enemy, damage);
      damage = blockResult.damage;
      logs.push(`格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}，剩餘傷害 ${damage}`);
    }

    if (starBreakerFixedDamage > 0) {
      damage += starBreakerFixedDamage;
    }

    let corrosiveOilDamage = 0;
    const corrosiveOil = attacker.gear?.effect?.type === 'corrosive_oil' ? attacker.gear.effect : null;
    const canUseCorrosiveOil = corrosiveOil &&
      !attacker._corrosiveOilUsedRound &&
      weaknessHit &&
      damage > 0 &&
      currentWounds >= (corrosiveOil.woundThreshold || 5);
    if (canUseCorrosiveOil) {
      attacker._corrosiveOilUsedRound = true;
      enemy.wounds = Math.max(0, currentWounds - (corrosiveOil.woundCost || 1));
      corrosiveOilDamage = corrosiveOil.damage || 3;
      logs.push(`${attacker.gear.name}：消耗 1 層傷口使傷口惡化，造成 ${corrosiveOilDamage} 點固定傷害`);
    }

    const playerBlockValue = this._playerShieldBlock(attacker, roll);
    if (playerBlockValue > 0) {
      CombatStatus.raiseBlock(attacker, playerBlockValue);
      logs.push(`${attacker.gear.name}：${attacker.name} 獲得格檔 ${playerBlockValue}`);
    }
    if (attacker.gear?.effect?.type === 'edge_face_damage' && diceRaw === attacker.gear.effect.backlashFace) {
      const backlash = Math.max(0, attacker.gear.effect.backlashDamage || 0);
      if (backlash > 0) {
        attacker.hp = Math.max(0, attacker.hp - backlash);
        logs.push(`${attacker.gear.name}：原始骰面 ${diceRaw}，${attacker.name} 受到 ${backlash} 點反噬傷害`);
      }
    }

    if (attacker.cls === 'explorer' && !realWeaknessHit && !resonanceWeaknessHit && !enemy.suspiciousFlaw && enemy.suspiciousFlawMarkedRound !== round) {
      enemy.suspiciousFlaw = true;
      enemy.suspiciousFlawMarkedRound = round;
      logs.push(`探索者：${attacker.name} 標記 1 個可疑弱點。`);
    }

    logs.push(`最終傷害：${damage}`);
    enemy.hp = Math.max(0, enemy.hp - damage);
    let rapierFollowHits = 0;
    const rapierDamageEvents = [];
    if (greatswordStrike) {
      const bonus = Math.max(1, greatswordRelic.effect?.attackBonus || 3);
      const before = Math.max(0, attacker._greatswordMomentum || 0);
      attacker._greatswordMomentum = before + bonus;
      logs.push(`${greatswordRelic.name}：重劍命中，${attacker.name} 基礎攻擊 +${bonus}（氣勢 ${before} → ${attacker._greatswordMomentum}）。`);
      if (greatswordResonance) {
        const extra = Math.max(0, greatswordResonance.effect?.extraMomentum || 0);
        if (extra > 0) {
          const beforeExtra = Math.max(0, attacker._greatswordMomentum || 0);
          attacker._greatswordMomentum = beforeExtra + extra;
          logs.push(`${greatswordResonance.name}：重劍共鳴，額外氣勢 +${extra}（${beforeExtra} → ${attacker._greatswordMomentum}）。`);
        }
      }
    }
    const rapierStrike = !!rapierRelic &&
      weapon?.family === 'sword' &&
      roll <= Math.max(1, rapierRelic.effect?.maxRoll || 3) &&
      damage > 0 &&
      enemy.hp > 0;
    if (rapierStrike) {
      const rate = Math.max(0, rapierRelic.effect?.damageRate ?? 0.5);
      const followBaseDamage = Math.max(damage, preBlockDamage);
      const followDamage = Math.max(1, Math.floor(followBaseDamage * rate));
      const chanceStep = Math.max(1, rapierRelic.effect?.chanceStep || 10);
      const minChance = Math.max(0, rapierRelic.effect?.minChance || 0);
      const maxFollowUps = Math.max(1, rapierRelic.effect?.maxFollowUps || 10);
      const guaranteedFollowUps = Math.max(0, rapierResonance?.effect?.guaranteedFollowUps || 0);
      const followDamageStep = Math.max(0, rapierResonance?.effect?.followDamageStep || 0);
      let chanceAttempts = 0;
      logs.push(`${rapierRelic.name}：低骰 ${roll}，本擊視為刺劍。`);
      if (followBaseDamage > damage) {
        logs.push(`${rapierRelic.name}：連擊以格檔前傷害 ${followBaseDamage} 計算。`);
      }
      for (let i = 1; i <= maxFollowUps && enemy.hp > 0; i++) {
        const guaranteedUsed = Math.max(0, attacker._rapierGuaranteedFollowUpsUsed || 0);
        const guaranteed = guaranteedUsed < guaranteedFollowUps;
        const chance = guaranteed ? 100 : Math.max(minChance, 100 - chanceAttempts * chanceStep);
        const success = guaranteed || chance >= 100 || Math.random() * 100 < chance;
        if (!success) {
          logs.push(`${rapierRelic.name}：第 ${i} 次連擊機率 ${chance}%，連擊停止。`);
          break;
        }
        if (guaranteed) {
          attacker._rapierGuaranteedFollowUpsUsed = guaranteedUsed + 1;
        } else {
          chanceAttempts++;
        }
        const currentFollowDamage = followDamage + (followDamageStep * rapierFollowHits);
        const followHpBefore = enemy.hp;
        enemy.hp = Math.max(0, enemy.hp - currentFollowDamage);
        rapierDamageEvents.push({
          type: 'rapier',
          damage: currentFollowDamage,
          from: followHpBefore,
          to: enemy.hp,
        });
        damage += currentFollowDamage;
        rapierFollowHits++;
        logs.push(guaranteed
          ? `${rapierResonance.name}：第 ${guaranteedUsed + 1} 次刺劍連擊必定成功，造成 ${currentFollowDamage} 傷害。`
          : `${rapierRelic.name}：第 ${i} 次連擊成功（${chance}%），造成 ${currentFollowDamage} 傷害。`);
      }
    }
    if (corrosiveOilDamage > 0) {
      enemy.hp = Math.max(0, enemy.hp - corrosiveOilDamage);
      logs.push(`腐蝕傷害：${corrosiveOilDamage}`);
    }
    if (damage > 0) {
      let woundGain = 0;
      if (painResonanceActive) {
        woundGain += Math.max(0, roll || 0);
        logs.push(`痛痕共鳴・爆發：本次造成傷害，附加 ${roll} 層傷口`);
      }
      if (weapon?.effect?.type === 'wound_on_hit') {
        const weaponWounds = weapon.effect.stacks || 1;
        woundGain += weaponWounds;
        logs.push(`${weapon.name}：主戰造成傷害，施加 ${weaponWounds} 層傷口`);
      }
      const woundBanner = banners.find(activeBanner =>
        !activeBanner.usedThisRound && this._bannerValue(activeBanner, 'first_hit_wound') > 0
      );
      const bannerWounds = woundBanner ? this._bannerValue(woundBanner, 'first_hit_wound') : 0;
      if (bannerWounds > 0) {
        woundGain += bannerWounds;
        woundBanner.usedThisRound = true;
        logs.push(`${woundBanner.name}・${woundBanner.faceName}：本回合第一次擊中，施加 ${bannerWounds} 層傷口`);
      }
      if (painMask) {
        const step = painMask.effect.damagePerWound || 4;
        const stacksPerStep = painMask.effect.stacksPerStep || 1;
        const extraStacks = Math.floor(preWoundDamage / step) * stacksPerStep;
        if (extraStacks > 0) {
          woundGain += extraStacks;
          logs.push(`痛苦面具：原始傷害 ${preWoundDamage}，額外施加 ${extraStacks} 層傷口`);
        }
      }
      const serratedOil = attacker.gear?.effect?.type === 'serrated_oil' ? attacker.gear.effect : null;
      if (serratedOil && !attacker._serratedOilUsedRound && roll >= (serratedOil.rollMin || 5)) {
        woundGain += serratedOil.stacks || 1;
        attacker._serratedOilUsedRound = true;
        logs.push(`${attacker.gear.name}：攻擊骰面 ${roll}，額外施加 ${serratedOil.stacks || 1} 層傷口`);
      }
      if (painSplinterBadge?.effect?.woundOnRoll && roll === painSplinterBadge.effect.woundOnRoll) {
        const badgeWounds = Math.max(0, painSplinterBadge.effect.woundStacks || 0);
        if (badgeWounds > 0) {
          woundGain += badgeWounds;
          logs.push(`${painSplinterBadge.name}：攻擊骰面 ${roll}，附加 ${badgeWounds} 層傷口`);
        }
      }
      if (woundGain > 0) {
        const beforeWounds = Math.max(0, Math.min(woundMax, enemy.wounds || 0));
        enemy.wounds = Math.min(woundMax, beforeWounds + woundGain);
        logs.push(`傷口：${beforeWounds} → ${enemy.wounds} 層`);
        if (explodeAtWounds && enemy.wounds >= explodeAtWounds) {
          const consumedWounds = enemy.wounds;
          const damagePerWound = painMask?.effect?.explodeDamagePerWound || 2;
          const explodeDamage = consumedWounds * damagePerWound;
          enemy.hp = Math.max(0, enemy.hp - explodeDamage);
          damage += explodeDamage;
          enemy.wounds = 0;
          logs.push(`${painResonanceActive ? '痛痕共鳴・爆發' : '痛苦面具融合'}：引爆並消耗 ${consumedWounds} 層傷口，每層 ${damagePerWound} 點，造成 ${explodeDamage} 點固定傷害`);
          if (weapon?.effect?.explodeDamage) {
            const weaponExplodeBonus = weapon.effect.explodeDamage;
            enemy.hp = Math.max(0, enemy.hp - weaponExplodeBonus);
            damage += weaponExplodeBonus;
            logs.push(`斷魂太刀：本次傷口引爆，額外造成 ${weaponExplodeBonus} 點固定傷害`);
          }
        }
      }
    }
    const enemyDead = enemy.hp <= 0;
    let enemyBlockGain = 0;
    const enemyWillBlock = !suppressEnemyAction && !stunned && !enemyDead && !enemy.blockBroken &&
      (intent?.type === 'block' || intent?.type === 'block_attack');
    if (enemyWillBlock) {
      const blockVal = Math.max(0, enemy.block || 0);
      if (blockVal > 0) {
        CombatStatus.raiseBlock(enemy, blockVal);
        enemyBlockGain = blockVal;
        logs.push(`${enemy.name} 格檔 +${blockVal}`);
        EnemyAbilities.afterEnemyBlock?.({
          enemy,
          intent,
          block: blockVal,
          logs,
          round,
        });
      }
    }

    let counterDmg = 0;
    let aoeCounter = 0;
    let enemyDiceRoll = null;
    const incomingDamageEvents = [];
    let enemyAttackFlow = !suppressEnemyAction && !stunned && !enemyDead &&
      ['attack', 'block_attack', 'dice_attack', 'aoe'].includes(intent?.type);
    if (enemyAttackFlow) {
      if (intent?.type === 'attack' || intent?.type === 'block_attack') counterDmg = enemy.attack;
      else if (intent?.type === 'dice_attack') {
        enemyDiceRoll = Math.ceil(Math.random() * 6);
        counterDmg = enemyDiceRoll;
        logs.push(`${enemy.name} 擲骰攻擊：${counterDmg}`);
      } else if (intent?.type === 'aoe') {
        aoeCounter = Math.max(1, enemy.attack - 2);
      }
    }

    const counterTarget = counterDmg > 0
      ? (squad.find(c => c.id === intent?.targetId && c.hp > 0 && !c.dead) || attacker)
      : null;
    const enemyActionResult = {
      counterDmg,
      aoeCounter,
      enemyDiceRoll,
      enemyAttackFlow,
      counterTarget,
      counterTargetId: counterTarget?.id || null,
      counterTargetName: counterTarget?.name || null,
      aoeDamageByChar: null,
      gazeSummary: null,
      fateSummary: null,
      bannerSummary: null,
      fateLuckyFace: null,
      fateUnluckyFaces: null,
    };
    if (!enemyDead && !suppressEnemyAction && !stunned) {
      EnemyAbilities.beforeEnemyAction(enemyActionResult, {
        attacker,
        enemy,
        squad,
        intent,
        logs,
        round,
      });
    }
    counterDmg = Math.max(0, enemyActionResult.counterDmg || 0);
    aoeCounter = Math.max(0, enemyActionResult.aoeCounter || 0);
    enemyDiceRoll = enemyActionResult.enemyDiceRoll;
    enemyAttackFlow = !!enemyActionResult.enemyAttackFlow;
    const aoeDamageByChar = enemyActionResult.aoeDamageByChar || null;
    if (enemyAttackFlow && (counterDmg > 0 || aoeCounter > 0)) {
      const attackReduction = Math.max(0, enemy.abilityState?.nextAttackReduction || 0);
      if (attackReduction > 0) {
        const beforeSingle = counterDmg;
        const beforeAoe = aoeCounter;
        counterDmg = Math.max(0, counterDmg - attackReduction);
        aoeCounter = Math.max(0, aoeCounter - attackReduction);
        enemy.abilityState.nextAttackReduction = 0;
        logs.push(`${enemy.name} 黑霧裂解：下一次攻擊 -${attackReduction}（${beforeSingle > 0 ? `${beforeSingle} → ${counterDmg}` : `全體 ${beforeAoe} → ${aoeCounter}`}）。`);
      }
    }

    if (counterDmg > 0) {
      const armorReduce = (combatMods || []).filter(m => m.type === 'damage_reduce').reduce((s, m) => s + m.value, 0);
      if (armorReduce > 0) {
        counterDmg = Math.max(0, counterDmg - armorReduce);
        logs.push(`護甲道具：反擊 -${armorReduce}，剩餘 ${counterDmg}`);
      }
      if (supportTacticalDamageReduce > 0 && counterTarget.id === attacker.id) {
        counterDmg = Math.max(0, counterDmg - supportTacticalDamageReduce);
        logs.push(`輔助戰術支援：${attacker.name} 受擊傷害 -${supportTacticalDamageReduce}，剩餘 ${counterDmg}`);
      }
      if (weapon?.effect?.type === 'zero_dmg_counter_reduce' && damage === 0) {
        counterDmg = Math.max(0, counterDmg - weapon.effect.value);
        logs.push(`弓：未造成傷害，反擊 -${weapon.effect.value}，剩餘 ${counterDmg}`);
      }
      counterDmg = CombatStatus.applyWoundTakenBonus(counterTarget, counterDmg, logs);
      if (CombatStatus.getBlock(counterTarget) > 0) {
        const blockResult = CombatStatus.consumeBlock(counterTarget, counterDmg);
        counterDmg = blockResult.damage;
        logs.push(`格檔吸收 ${blockResult.absorbed}，剩餘格檔 ${blockResult.block}，反擊 ${counterDmg}`);
      }
      if (counterDmg > 0) {
        counterDmg = CombatStatus.applyIncomingRiskBonuses(counterTarget, counterDmg, {
          allowRemorse: !wagerDice?.active,
          allowBacklash: true,
          logs,
          damageLabel: '受擊傷害',
          resultLabel: '反擊',
        });
        const beforeHp = counterTarget.hp;
        counterTarget.hp = Math.max(0, counterTarget.hp - counterDmg);
        incomingDamageEvents.push({
          type: 'counter',
          targetId: counterTarget.id,
          damage: counterDmg,
          from: beforeHp,
          to: counterTarget.hp,
        });
        logs.push(`${enemy.name} 攻擊 ${counterTarget.name}，造成 ${counterDmg} 傷害。`);
      } else {
        logs.push(`${enemy.name} 的反擊被完全抵消。`);
      }
    } else if (suppressEnemyAction && !enemyDead && !deferEnemyAction) {
      logs.push('追加攻擊不觸發敵人行動。');
    } else if (stunned) {
      logs.push(`${enemy.name} 被震懾，無法行動。`);
    } else if (intent?.type === 'block' && !enemyDead) {
      logs.push(`${enemy.name} 採取防禦，沒有反擊。`);
    } else if (intent?.type === 'banner_switch' && !enemyDead && !enemyActionResult.bannerSummary) {
      logs.push(`${enemy.name} 換旗整隊，沒有攻擊。`);
    }

    if (!enemyDead) {
      EnemyAbilities.afterEnemyAction(enemyActionResult, {
        attacker,
        enemy,
        squad,
        intent,
        logs,
        round,
      });
    }

    return {
      roll,
      rawRoll: rollResult.raw,
      floored: rollResult.floored,
      damage,
      counterDmg,
      counterTargetId: counterTarget?.id || null,
      counterTargetName: counterTarget?.name || null,
      enemyBlockGain,
      aoeCounter,
      aoeDamageByChar,
      enemyDiceRoll,
      gazeRoll: enemyActionResult.gazeRoll || null,
      gazeSummary: enemyActionResult.gazeSummary || null,
      fateRoll: enemyActionResult.fateRoll || null,
      fateSummary: enemyActionResult.fateSummary || null,
      bannerSummary: enemyActionResult.bannerSummary || null,
      fateLuckyFace: enemyActionResult.fateLuckyFace || null,
      fateUnluckyFaces: Array.isArray(enemyActionResult.fateUnluckyFaces) ? enemyActionResult.fateUnluckyFaces : [],
      enemyAttackFlow,
      enemyActionDeferred: !!deferEnemyAction && !enemyDead && !stunned,
      incomingDamageEvents,
      weaknessHit,
      realWeaknessHit,
      eagleFeatherNativeHit,
      resonanceWeaknessHit,
      grapplingHookAssisted,
      rapierFollowHits,
      rapierDamageEvents,
      stunned,
      enemyDead,
      logs,
    };
  },

  fallenEchoMod(squad, fallenChar) {
    for (const c of squad) {
      if (c.id === fallenChar.id || c.hp <= 0) continue;
      const isFused = c.fusedRelic?.effect?.type === 'fallen_attack_bonus';
      const isCarried = c.relic?.effect?.type === 'fallen_attack_bonus';
      if (isFused || isCarried) {
        const bonus = isFused ? (c.fusedRelic.effect.value + CONFIG.FUSED_FALLEN_ECHO_EXTRA_BONUS) : c.relic.effect.value;
        return { type: 'attack_bonus', value: bonus, source: 'fallen_echo', char: c };
      }
    }
    return null;
  },

  _relicCombatFloor(attacker) {
    const carried = attacker.relic?.effect?.type === 'combat_floor_bonus' ? attacker.relic.effect.value : 0;
    const fused = attacker.fusedRelic?.effect?.type === 'combat_floor_bonus'
      ? attacker.fusedRelic.effect.fusedValue
      : 0;
    return Math.max(carried, fused);
  },

  _bannerValue(banner, type) {
    if (!banner || banner.faceType !== type) return 0;
    const values = Array.isArray(banner.values) ? banner.values : [];
    return values[Math.max(0, (banner.level || 1) - 1)] || 0;
  },

  _playerShieldBlock(attacker, roll) {
    const effect = attacker?.gear?.effect;
    if (effect?.type !== 'player_block_on_attack') return 0;
    const divisor = effect.rollDivisor || 2;
    const minimum = effect.min || 1;
    return Math.max(minimum, Math.floor((roll || 0) / divisor));
  },

  _bannerEagleNativeDamage(banner) {
    if (!banner || banner.faceType !== 'eagle_native_weakness') return 0;
    const values = Array.isArray(banner.nativeDamage) ? banner.nativeDamage : [];
    return values[Math.max(0, (banner.level || 1) - 1)] || 0;
  },

  _bannerEagleNativeDuration(banner, roll) {
    if (!banner || banner.faceType !== 'eagle_native_weakness') return 0;
    const index = Math.max(0, (banner.level || 1) - 1);
    const threshold = Array.isArray(banner.rollGreaterThan) ? banner.rollGreaterThan[index] : null;
    if (!Number.isFinite(threshold) || roll <= threshold) return 0;
    const durations = Array.isArray(banner.durations) ? banner.durations : [];
    return durations[index] || 0;
  },

  _nextEagleWeakness(enemy, seed = 0) {
    const used = this._nativeWeaknessUsedSet(enemy);
    const start = Number(seed) || Math.ceil(Math.random() * 6);
    for (let step = 1; step <= 6; step++) {
      const value = ((start + step - 1) % 6) + 1;
      if (!used.has(value)) return value;
    }
    return null;
  },

  _nativeWeaknessSet(enemy) {
    return new Set(CombatStatus.nativeWeaknesses(enemy, 'enemy'));
  },

  _nativeWeaknessUsedSet(enemy) {
    return new Set(CombatStatus.nativeWeaknesses(enemy, 'used'));
  },

  _tempWeaknessSet(enemy, omit = {}) {
    const values = [];
    if (!omit.telescope) values.push(...CombatStatus.tempWeaknesses(enemy, 'normal'));
    if (!omit.gambler) values.push(...CombatStatus.tempWeaknesses(enemy, 'gambler'));
    if (!omit.eagle) values.push(...CombatStatus.tempWeaknesses(enemy, 'eagle'));
    return new Set(values);
  },

  _nextTempWeakness(enemy, seed = 0, extraUsed = [], omit = {}) {
    const used = new Set([
      ...this._nativeWeaknessSet(enemy),
      ...this._tempWeaknessSet(enemy, omit),
      ...extraUsed,
    ]);
    const start = Number(seed) || Math.ceil(Math.random() * 6);
    for (let step = 1; step <= 6; step++) {
      const value = ((start + step - 1) % 6) + 1;
      if (!used.has(value)) return value;
    }
    return null;
  },

  _clearEagleWeakness(enemy) {
    CombatStatus.clearTempWeakness(enemy, { source: 'eagle' });
    CombatStatus.setEagleNativeWeakness(enemy, null);
  },

  _setEagleWeakness(enemy, { kind, value, duration = 0, round = 1, source = null }) {
    if (!value) return false;
    this._clearEagleWeakness(enemy);
    if (kind === 'native') {
      CombatStatus.setEagleNativeWeakness(enemy, {
        value,
        expiresRound: Number.isFinite(duration) ? round + duration + 1 : null,
        source,
      });
    } else {
      CombatStatus.setTempWeakness(enemy, value, { source: 'eagle' });
    }
    return true;
  },

  _calculateDamage(baseAttack, roll) {
    return Math.max(0, baseAttack + roll);
  },

  _nextGamblerTempWeakness(enemy, roll) {
    return this._nextTempWeakness(enemy, (roll % 6) + 1, [], { gambler: true });
  },

  _nextGamblerTempWeaknesses(enemy, roll, count = 1) {
    const result = [];
    let value = (roll % 6) + 1;
    for (let step = 0; step < 6 && result.length < count; step++) {
      const candidate = ((value + step - 1) % 6) + 1;
      const blocked = new Set([
        ...this._nativeWeaknessSet(enemy),
        ...this._tempWeaknessSet(enemy, { gambler: true }),
        ...result,
      ]);
      if (blocked.has(candidate)) continue;
      result.push(candidate);
    }
    return result;
  },

  _nextNativeWeakness(enemy, roll) {
    const used = this._nativeWeaknessUsedSet(enemy);
    for (let step = 1; step <= 6; step++) {
      const value = ((roll + step - 1) % 6) + 1;
      if (!used.has(value)) return value;
    }
    return null;
  },

  _randomNativeWeakness(enemy) {
    const used = this._nativeWeaknessUsedSet(enemy);
    const available = [];
    for (let value = 1; value <= 6; value++) {
      if (!used.has(value)) available.push(value);
    }
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  },

  _eagleFeatherShatterTarget(enemy, activeNativeWeaknesses = []) {
    const disabled = new Set(CombatStatus.disabledNativeWeaknesses(enemy));
    if (enemy?.weakness && !disabled.has(enemy.weakness)) return enemy.weakness;
    return activeNativeWeaknesses.find(w => w && !disabled.has(w)) || null;
  },

  _shatterNativeWeakness(enemy, face) {
    return CombatStatus.shatterNativeWeakness(enemy, face);
  },
};

// Backward-compatible alias for older references.
const Combat = CombatRules;
