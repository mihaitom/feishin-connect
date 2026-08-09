import { motion } from 'motion/react';
import { ReactNode } from 'react';

import { animationVariants } from '/@/shared/components/animations/animation-variants';

interface FadeInProps {
    children: ReactNode;
}

export const FadeIn = ({ children }: FadeInProps) => {
    return (
        <motion.div
            animate="show"
            initial="hidden"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            variants={animationVariants.fadeInUp}
        >
            {children}
        </motion.div>
    );
};
