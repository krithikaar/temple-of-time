/**
 * TEMPLE of Time - Master Application Entry Point
 * Pure Vanilla TypeScript SPA Engine with Zero Heavy Frontend Frameworks.
 */

import { ScreenState, ParticipantProfile, ChamberDefinition, SessionResult } from './types';
import { getProfile, saveProfile, getStoredAuthSession, getStoredUserProfile, updateDailyStreakOnReturn, triggerBackgroundSync, getLatestSession } from './store';
import { refreshSessionSilently } from './supabase';
import { initAudioContext } from './audio';
import { renderAuthScreen } from './ui/auth';
import { renderDashboard } from './ui/dashboard';
import { renderFeedbackScreen } from './ui/feedback';
import { getCurrentUnlockedStage, completeCurrentNode } from './quest/questState';
import { GrandParlorTaskRunner } from './tasks/grandParlor';
import { WeatherSpireTaskRunner } from './tasks/weatherSpire';
import { AviaryTaskRunner } from './tasks/aviary';
import { PuzzlerStudyTaskRunner } from './tasks/puzzlerStudy';
import { VaultArtifactsTaskRunner } from './tasks/vaultArtifacts';
import './index.css';

class TempleApp {
  private rootElement: HTMLElement;
  private currentScreen: ScreenState = 'dashboard';
  private currentProfile: ParticipantProfile | null = null;
  private activeTaskRunner: WeatherSpireTaskRunner | GrandParlorTaskRunner | AviaryTaskRunner | PuzzlerStudyTaskRunner | VaultArtifactsTaskRunner | null = null;

  constructor() {
    const root = document.getElementById('app');
    if (!root) throw new Error('Missing #app root element');
    this.rootElement = root;

    this.setupGlobalListeners();
    this.init();
  }

  private setupGlobalListeners(): void {
    // Unlock Web Audio API on first user gesture
    const unlockAudio = () => {
      initAudioContext();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    // Automatic sync retry on window online event
    window.addEventListener('online', () => {
      triggerBackgroundSync().catch(() => {});
    });
  }

  private async init(): Promise<void> {
    const cachedSession = getStoredAuthSession();
    const profile = getStoredUserProfile();

    // Check if the user has an enrolled profile with an assigned TEMP-XXXX ID
    const isEnrolled = profile && profile.subject_id && /^TEMP-\d+$/i.test(profile.subject_id);

    if (!isEnrolled) {
      // Direct new visitors to the enrollment screen to receive their auto-assigned Subject ID
      this.navigateTo('auth');
      return;
    }

    if (cachedSession) {
      // Silently refresh session via refresh_token if available
      try {
        await refreshSessionSilently();
      } catch (err) {
        console.warn('Silent session refresh deferred:', err);
      }
    }

    // Increment longitudinal daily streak if visit is on a new calendar day
    this.currentProfile = updateDailyStreakOnReturn(profile);

    // Route to Quest Progression Dashboard
    this.navigateTo('dashboard');

    // Background sync any pending offline trials
    triggerBackgroundSync().catch(() => {});
  }

  public navigateTo(screen: ScreenState, extraData?: unknown): void {
    this.currentScreen = screen;
    this.render(extraData);
  }

  private render(extraData?: unknown): void {
    this.rootElement.innerHTML = '';

    switch (this.currentScreen) {
      case 'auth':
        renderAuthScreen(this.rootElement, (newProfile) => {
          this.currentProfile = newProfile;
          this.navigateTo('dashboard');
        });
        break;

      case 'dashboard':
        if (!this.currentProfile) {
          this.navigateTo('auth');
          return;
        }
        renderDashboard(this.rootElement, this.currentProfile, {
          onEnterChamber: (chamber: ChamberDefinition) => {
            if (chamber.status === 'active') {
              this.navigateTo('task_arena', chamber);
            }
          },
          onOpenAuth: () => {
            this.navigateTo('auth');
          }
        });
        break;

      case 'task_arena': {
        if (!this.currentProfile) {
          this.navigateTo('auth');
          return;
        }

        const chamberStageMap: Record<string, number> = {
          'room-1': 1,
          'room-2': 3,
          'room-3': 5,
          'room-4': 6,
          'room-5': 8
        };
        const handleChamberComplete = (roomId: string) => {
          const stageIndex = chamberStageMap[roomId];
          if (typeof stageIndex === 'number') {
            completeCurrentNode(stageIndex, { completedViaArena: true, score: 95 });
          }
          this.currentProfile = getProfile();
          this.navigateTo('dashboard');
        };

        const chamber = extraData as ChamberDefinition | undefined;
        if (chamber?.id === 'room-5') {
          const vaultRunner = new VaultArtifactsTaskRunner(this.rootElement, this.currentProfile, {
            onComplete: () => handleChamberComplete('room-5'),
            onExit: () => this.navigateTo('dashboard')
          });
          this.activeTaskRunner = vaultRunner;
          vaultRunner.start();
        } else if (chamber?.id === 'room-4') {
          const studyRunner = new PuzzlerStudyTaskRunner(this.rootElement, this.currentProfile, {
            onComplete: () => handleChamberComplete('room-4'),
            onExit: () => this.navigateTo('dashboard')
          });
          this.activeTaskRunner = studyRunner;
          studyRunner.start();
        } else if (chamber?.id === 'room-3') {
          const aviaryRunner = new AviaryTaskRunner(this.rootElement, this.currentProfile, {
            onComplete: () => handleChamberComplete('room-3'),
            onExit: () => this.navigateTo('dashboard')
          });
          this.activeTaskRunner = aviaryRunner;
          aviaryRunner.start();
        } else if (chamber?.id === 'room-2') {
          const parlorRunner = new GrandParlorTaskRunner(this.rootElement, this.currentProfile, {
            onComplete: () => handleChamberComplete('room-2'),
            onExit: () => this.navigateTo('dashboard')
          });
          this.activeTaskRunner = parlorRunner;
          parlorRunner.start();
        } else if (!chamber || chamber.id === 'room-1') {
          const spireRunner = new WeatherSpireTaskRunner(this.rootElement, this.currentProfile, {
            onComplete: () => handleChamberComplete('room-1'),
            onExit: () => this.navigateTo('dashboard')
          });
          this.activeTaskRunner = spireRunner;
          spireRunner.start();
        } else {
          this.navigateTo('dashboard');
        }
        break;
      }

      case 'feedback':
        const session = (extraData as SessionResult) || getLatestSession();
        if (!session) {
          this.navigateTo('dashboard');
          return;
        }
        renderFeedbackScreen(this.rootElement, session, {
          onReturnDashboard: () => {
            this.navigateTo('dashboard');
          },
          onReplayChamber: () => {
            this.navigateTo('task_arena');
          }
        });
        break;
    }
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new TempleApp();
});
