import { useTranslation } from 'react-i18next'

const STEP_IDS = [1, 2, 3, 4] as const

export function HireMovingEasySteps() {
  const { t } = useTranslation()

  return (
    <section className="rounded-xl border bg-card px-4 py-8 sm:px-6 sm:py-10">
      <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t('moving.easyStepsTitle')}
      </h2>

      <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4 lg:gap-6">
        {STEP_IDS.map((step) => (
          <li key={step} className="space-y-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-highlight text-sm font-semibold text-[#222222] shadow-sm">
              {step}
            </span>
            <h3 className="text-base font-semibold leading-snug text-foreground">
              {t(`moving.easyStep${step}Title`)}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`moving.easyStep${step}`)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
