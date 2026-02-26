import Image from "next/image";
import Link from "next/link";

import { AuthPanel } from "@/components/shared/auth-panel";
import { HomeAuthSection } from "@/components/shared/home-auth-section";

import styles from "./home-legacy.module.css";

export default async function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.mainhead}>
          <div className={styles.ttlogo}>
            <Link href="/">
              <Image src="/images/TTlogo.png" alt="Thinkertools logo" width={220} height={48} priority />
            </Link>
          </div>
          <nav className={styles.navbar}>
            <Link href="/library" className={styles.navbarLink}>
              Experience
            </Link>
            <Link href="/library" className={styles.navbarLink}>
              Demos
            </Link>
            <Link href="#about" className={styles.navbarLink}>
              About
            </Link>
            <Link href="mailto:info@thinkertools.org" className={styles.navbarLink}>
              Support
            </Link>
            <AuthPanel />
          </nav>
        </header>

        <div className={styles.columns}>
          <section className={styles.column}>
            <div className={`${styles.columnhead} ${styles.red}`}>
              <span className={styles.columnheadTitle}>Welcome to Thinkertools</span>
              <br />
              Free tools for building knowledge
            </div>

            <div id="about" className={styles.contentbox}>
              We help you learn about what intrigues you. We help you build new knowledge that will benefit
              humankind and the planet. People want to connect with others to be a key part of our collective
              intelligence. We help you make those connections and collaborate effectively.
              <br />
              <br />
              We want Thinkertools and everyone who uses the tools to be part of something big. We don&apos;t think
              anyone would deny we live during a time with problems. Solving these problems and ensuring we don&apos;t
              cause new problems requires each of us to think, to understand, to reason, to question, but most
              importantly to help build new knowledge. Because without that, we&apos;re sunk.
              <br />
              <br />
              We also want Thinkertools to be part of something personally satisfying. We&apos;re an inquisitive species.
              We want to know why there&apos;s a universe, or what&apos;s the meaning of the novel I just read, or how does
              the brain rewire during isolation? All of us want to be part of a solution, or to solve a mystery.
              Thinkertools is a great place to start to satisfy your curiosity.
              <br />
              <br />
              For more information see what&apos;s in{" "}
              <Link href="#about" className={styles.textlink}>
                About
              </Link>{" "}
              and{" "}
              <Link href="/library" className={styles.textlink}>
                Demos
              </Link>
              .
            </div>

            <div className={styles.contentbox}>
              <strong>Cookies, Privacy, Data, Terms of Use</strong>
              <br />
              We don&apos;t collect cookies other than your login for use during a session. No personal data is sold or
              provided to any other entity. For more information on our policies,{" "}
              <a
                href="https://thinkertools.org/policies.html"
                className={styles.textlink}
                target="_blank"
                rel="noreferrer"
              >
                go to our policies page
              </a>
              .
            </div>
          </section>

          <section className={styles.column}>
            <HomeAuthSection
              loginHeadClassName={styles.loginhead}
              loginTitleClassName={styles.loginlink}
              loginHintClassName={styles.loginhint}
            />

            <div className={`${styles.toolbox} ${styles.woi}`}>
              <Link href="/woi" className={styles.toollink}>
                Web of Inquiry
              </Link>
            </div>

            <div className={styles.toolStats}>
              <div className={styles.toolStatsImage}>
                <Link href="/woi">
                  <Image src="/images/grid_screenshot.png" alt="Web of Inquiry screenshot" width={240} height={180} />
                </Link>
              </div>
            </div>

            <div className={`${styles.toolbox} ${styles.quipx} ${styles.disabledTool}`} aria-disabled="true">
              <span className={`${styles.toollink} ${styles.disabledToolLink}`}>
                Quipx
              </span>
              <span className={styles.inDevelopmentBadge} aria-hidden="true">
                In development
              </span>
            </div>

            <div className={styles.toolStats}>
              <div className={styles.toolStatsImage}>
                <Image src="/images/session_screenshot.png" alt="Quipx screenshot" width={240} height={180} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
