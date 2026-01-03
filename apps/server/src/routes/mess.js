import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireStudent, requireWarden } from '../middleware/rbac.js'

const router = Router()

router.get('/menu', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('mess_menu')
      .select('*')
      .order('day_of_week')

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.put('/menu', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { day_of_week, meal_type, items } = req.body

    if (!day_of_week || !meal_type || !items) {
      return res.status(400).json({ success: false, error: 'day_of_week, meal_type, and items are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('mess_menu')
      .upsert(
        { day_of_week, meal_type, items },
        { onConflict: 'day_of_week,meal_type' }
      )
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.post('/review', authenticate, requireStudent, async (req, res, next) => {
  try {
    const { meal_type, date, rating, feedback } = req.body

    if (!meal_type || !date || rating === undefined) {
      return res.status(400).json({ success: false, error: 'meal_type, date, and rating are required' })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'rating must be between 1 and 5' })
    }

    const { data, error } = await supabaseAdmin
      .from('mess_reviews')
      .upsert(
        {
          student_id: req.user.id,
          meal_type,
          date,
          rating,
          feedback
        },
        { onConflict: 'student_id,date,meal_type' }
      )
      .select()
      .single()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

router.get('/reviews', authenticate, requireWarden, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('mess_reviews')
      .select(`
        *,
        student:student_id (
          id,
          roll_number,
          profile:id (
            full_name
          )
        )
      `)
      .order('date', { ascending: false })

    if (error) throw error

    // Calculate averages
    const averages = data.reduce((acc, review) => {
      if (!acc[review.meal_type]) {
        acc[review.meal_type] = { totalRating: 0, count: 0 }
      }
      acc[review.meal_type].totalRating += review.rating
      acc[review.meal_type].count += 1
      return acc
    }, {})

    Object.keys(averages).forEach(meal_type => {
      averages[meal_type] = averages[meal_type].totalRating / averages[meal_type].count
    })

    res.json({ success: true, data: { reviews: data, averages } })
  } catch (error) {
    next(error)
  }
})

export default router
