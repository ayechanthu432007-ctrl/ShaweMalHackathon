import logoMark from '@/assets/shawemal-logo-mark.png'
import { cn } from '@/lib/utils'

/** How many copies of the logo are stacked to give it thickness, and how thick it is in total. */
const LAYERS = 16
const DEPTH_PX = 30

type RotatingLogoProps = {
  alt: string
  className?: string
}

/**
 * The Shawe Mal logo as a solid object turning on its vertical axis.
 *
 * The artwork is the original PNG, untouched: copies of it are stacked along the depth
 * axis so the edge reads as real thickness when the logo turns sideways. The copies in the
 * middle are darkened to look like the cut edge; the front and back faces stay sharp.
 * People who ask for reduced motion get the same object standing still at a slight angle.
 */
export function RotatingLogo({ alt, className }: RotatingLogoProps) {
  return (
    <div className={cn('logo3d relative aspect-square w-full max-w-xs', className)} role="img" aria-label={alt}>
      <div className="logo3d-float absolute inset-0">
        <div className="logo3d-spin absolute inset-0">
          {Array.from({ length: LAYERS }, (_, index) => {
            const isFace = index === 0 || index === LAYERS - 1
            const z = (index / (LAYERS - 1) - 0.5) * DEPTH_PX
            return (
              <img
                key={index}
                src={logoMark}
                alt=""
                aria-hidden
                draggable={false}
                className={cn('absolute inset-0 h-full w-full select-none object-contain', isFace ? 'logo3d-face' : 'logo3d-edge')}
                style={{ transform: `translateZ(${z.toFixed(2)}px)` }}
              />
            )
          })}
        </div>
      </div>
      {/* The shadow on the "ground" narrows as the logo turns edge-on and shrinks as it floats up. */}
      <div className="logo3d-shadow pointer-events-none absolute inset-x-[18%] -bottom-[6%] h-[7%] rounded-[50%] bg-black/40 blur-md" aria-hidden />
    </div>
  )
}
