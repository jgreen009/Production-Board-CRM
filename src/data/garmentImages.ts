import type { GarmentType } from '@/types'

import tshirtFront from '@/assets/mockups/tshirt-front.png'
import tshirtBack from '@/assets/mockups/tshirt-back.png'
import poloFront from '@/assets/mockups/polo-front.png'
import poloBack from '@/assets/mockups/polo-back.png'
import hiVizVestFront from '@/assets/mockups/hi-viz-vest-front.png'
import hiVizVestBack from '@/assets/mockups/hi-viz-vest-back.png'
import singletFront from '@/assets/mockups/singlet-front.png'
import singletBack from '@/assets/mockups/singlet-back.png'
import crewNeckFront from '@/assets/mockups/crew-neck-front.png'
import crewNeckBack from '@/assets/mockups/crew-neck-back.png'
import hoodyFront from '@/assets/mockups/hoody-front.png'
import hoodyBack from '@/assets/mockups/hoody-back.png'
import shortsFront from '@/assets/mockups/shorts-front.png'
import shortsBack from '@/assets/mockups/shorts-back.png'
import pantsFront from '@/assets/mockups/pants-front.png'
import pantsBack from '@/assets/mockups/pants-back.png'
import bennieFront from '@/assets/mockups/bennie-front.png'
import bennieBack from '@/assets/mockups/bennie-back.png'
import hatsFront from '@/assets/mockups/hats-front.png'
import hatsBack from '@/assets/mockups/hats-back.png'

export interface GarmentImagePair {
  front: string
  back: string
}

// Real garment reference photos, one front/back pair per catalog type.
// "Shirt" and "Customized" have no dedicated photo in mockup_images/, so
// GarmentMockup falls back to a drawn silhouette for those two.
export const GARMENT_IMAGES: Partial<Record<GarmentType, GarmentImagePair>> = {
  'T-shirt': { front: tshirtFront, back: tshirtBack },
  Polo: { front: poloFront, back: poloBack },
  'Hi-Viz vest': { front: hiVizVestFront, back: hiVizVestBack },
  Singlet: { front: singletFront, back: singletBack },
  'Crew neck (jumper)': { front: crewNeckFront, back: crewNeckBack },
  Hoody: { front: hoodyFront, back: hoodyBack },
  Shorts: { front: shortsFront, back: shortsBack },
  Pants: { front: pantsFront, back: pantsBack },
  Bennie: { front: bennieFront, back: bennieBack },
  Hats: { front: hatsFront, back: hatsBack },
}
