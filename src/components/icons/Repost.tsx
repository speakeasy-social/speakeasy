import React from 'react'
import {G, Path, Svg} from 'react-native-svg'

import {Props, useCommonSVGProps} from './common'

export const Repost_Stroke2_Corner2_Rounded = React.forwardRef<Svg, Props>(
  function RepostIcon(props, ref) {
    const {size, style, ...rest} = useCommonSVGProps(props)

    return (
      <Svg
        {...rest}
        ref={ref}
        viewBox="-50 0 1000.000000 831.000000"
        width={size}
        height={size}
        style={style}>
        <G
          transform="translate(0.000000,831.000000) scale(0.100000,-0.100000)"
          fill="none"
          stroke="currentColor"
          strokeWidth="600">
          <Path
            d="M4934 8282 c-101 -36 -175 -118 -216 -242 -22 -64 -22 -73 -26 -834
l-3 -769 -192 7 c-1028 36 -2016 -292 -2825 -938 -558 -445 -1017 -1051 -1303
-1718 -281 -656 -407 -1396 -359 -2098 28 -394 91 -730 213 -1131 25 -79 71
-231 103 -337 31 -106 60 -189 64 -185 3 4 32 96 64 203 181 612 240 780 365
1042 567 1194 1680 2020 2966 2202 200 29 327 36 617 36 l287 0 3 -732 c4
-723 4 -734 26 -798 42 -126 125 -215 230 -246 103 -32 240 -6 343 63 46 31
1820 1447 3217 2568 361 289 409 337 452 452 12 32 27 89 33 126 22 141 -32
303 -139 415 -32 34 -844 690 -1804 1457 -1403 1123 -1760 1403 -1820 1432
-65 32 -86 37 -160 40 -63 3 -98 -1 -136 -15z"
          />
        </G>
      </Svg>
    )
  },
)
